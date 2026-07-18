/**
 * Enterprise Message Bus — NATS JetStream
 *
 * Architecture decision: NATS JetStream over Kafka/RabbitMQ for this workload.
 * Rationale:
 *   • Single 8MB binary, trivial Kubernetes operator
 *   • JetStream provides persistent streams, at-least-once delivery, DLQ
 *   • Ideal for IoT/camera event volumes (millions of small messages/sec)
 *   • Core NATS subject routing covers pub/sub needs with zero overhead
 *   • Simpler ops than Kafka for edge/hybrid deployments
 *
 * Fallback: When NATS is not configured the service routes events through
 * the existing in-process vmsEventService, ensuring zero code changes
 * are required in callers during development.
 */

import { getLogger } from './logger';
import { messageBusPublished } from './metrics';
import { vmsEventService, VmsEventType } from '../vmsEventService';

const log = getLogger('messagebus');

// ── Stream definitions ────────────────────────────────────────────────────────

export const STREAMS = {
  VMS_EVENTS:     { name: 'VMS_EVENTS',     subjects: ['vms.events.>'],   maxAge: 7 * 24 * 60 * 60 * 1_000_000_000 },  // 7d in ns
  VMS_ALARMS:     { name: 'VMS_ALARMS',     subjects: ['vms.alarms.>'],   maxAge: 30 * 24 * 60 * 60 * 1_000_000_000 }, // 30d
  VMS_AUDIT:      { name: 'VMS_AUDIT',      subjects: ['vms.audit.>'],    maxAge: 365 * 24 * 60 * 60 * 1_000_000_000 }, // 1yr
  VMS_TELEMETRY:  { name: 'VMS_TELEMETRY',  subjects: ['vms.telemetry.>'], maxAge: 24 * 60 * 60 * 1_000_000_000 },     // 24h
} as const;

// DLQ stream for unprocessable messages
export const DLQ_STREAM = { name: 'VMS_DLQ', subjects: ['vms.dlq.>'], maxAge: 7 * 24 * 60 * 60 * 1_000_000_000 };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BusMessage<T = unknown> {
  subject: string;
  data: T;
  headers?: Record<string, string>;
}

export type MessageHandler<T = unknown> = (msg: BusMessage<T>) => Promise<void>;

// ── NATS client (optional) ────────────────────────────────────────────────────

let nc: any = null;       // NatsConnection
let js: any = null;       // JetStreamClient
let jsm: any = null;      // JetStreamManager
let natsAvailable = false;

async function initNats(): Promise<void> {
  const servers = process.env.NATS_URL ?? process.env.NATS_SERVERS;
  if (!servers) {
    log.info('NATS_URL not configured — message bus running in in-process mode (vmsEventService)');
    return;
  }

  try {
    const { connect, StringCodec } = await import('nats');

    nc = await connect({
      servers: servers.split(',').map(s => s.trim()),
      reconnect: true,
      maxReconnectAttempts: -1,   // retry forever
      reconnectTimeWait: 2000,
      pingInterval: 30_000,
      name: `sentinel-vms-${process.env.HOSTNAME ?? 'node'}`,
    });

    js  = nc.jetstream();
    jsm = await nc.jetstreamManager();

    // Ensure all streams exist
    for (const stream of [...Object.values(STREAMS), DLQ_STREAM]) {
      try {
        await jsm.streams.add({
          name: stream.name,
          subjects: stream.subjects,
          max_age: stream.maxAge,
          storage: 'file',
          num_replicas: parseInt(process.env.NATS_REPLICAS ?? '1', 10),
          retention: 'limits',
          discard: 'old',
        });
        log.debug(`JetStream stream created: ${stream.name}`);
      } catch (err: any) {
        // Stream already exists — update config
        if (err?.message?.includes('stream name already in use')) {
          log.debug(`JetStream stream exists: ${stream.name}`);
        } else {
          log.warn(`Failed to create stream ${stream.name}`, { error: err.message });
        }
      }
    }

    natsAvailable = true;
    log.info('NATS JetStream connected and streams provisioned', { servers });

    // Monitor disconnect
    (async () => {
      for await (const s of nc.status()) {
        if (s.type === 'disconnect') { natsAvailable = false; log.warn('NATS disconnected'); }
        if (s.type === 'reconnect')  { natsAvailable = true;  log.info('NATS reconnected'); }
      }
    })().catch(() => {});

  } catch (err: any) {
    log.warn('NATS connection failed — falling back to in-process event bus', { error: err.message });
  }
}

// ── messageBusService ─────────────────────────────────────────────────────────

export const messageBusService = {
  /** Publish a message to a NATS subject. Falls back to vmsEventService. */
  async publish<T>(subject: string, data: T, headers?: Record<string, string>): Promise<void> {
    messageBusPublished.inc({ subject: subject.split('.')[1] ?? subject, stream: subject.split('.')[0] ?? 'unknown' });

    if (natsAvailable && js) {
      try {
        const { StringCodec, headers: natsHeaders } = await import('nats');
        const sc = StringCodec();
        const hdrs = natsHeaders();
        if (headers) {
          for (const [k, v] of Object.entries(headers)) hdrs.set(k, v);
        }
        hdrs.set('X-Source', 'sentinel-vms');
        hdrs.set('X-Timestamp', new Date().toISOString());
        await js.publish(subject, sc.encode(JSON.stringify(data)), { headers: hdrs });
        return;
      } catch (err: any) {
        log.warn('NATS publish failed — falling back to in-process bus', { subject, error: err.message });
      }
    }

    // In-process fallback: map VMS subjects → vmsEventService
    const parts = subject.split('.');
    if (parts[0] === 'vms' && parts[1] === 'events' && parts[2]) {
      const eventType = parts[2].toUpperCase() as VmsEventType;
      try {
        vmsEventService.emit(eventType, subject, data as any, (data as any).severity ?? 'INFO');
      } catch { /* unmapped event type */ }
    }
  },

  /** Subscribe to a NATS subject (JetStream consumer). Falls back to vmsEventService. */
  async subscribe<T>(
    subject: string,
    handler: MessageHandler<T>,
    opts?: { durable?: string; deliverNew?: boolean }
  ): Promise<() => void> {
    if (natsAvailable && js) {
      try {
        const { StringCodec, AckPolicy } = await import('nats');
        const sc = StringCodec();

        const consumer = await js.consumers.get(
          subject.split('.')[0] + '_' + (subject.split('.')[1] ?? 'EVENTS').toUpperCase(),
          opts?.durable
        ).catch(async () => {
          // Create ephemeral consumer if durable not found
          return js.consumers.get(
            subject.split('.')[0] + '_' + (subject.split('.')[1] ?? 'EVENTS').toUpperCase()
          );
        });

        const sub = await consumer.consume();
        const streamSubject = subject;
        (async () => {
          for await (const msg of sub) {
            try {
              const data = JSON.parse(sc.decode(msg.data)) as T;
              await handler({ subject: streamSubject, data });
              msg.ack();
            } catch (err: any) {
              log.warn('Message handler error — nacking', { subject, error: err.message });
              msg.nak(5000);
            }
          }
        })().catch(err => log.error('NATS consumer loop error', { error: err.message }));

        return () => { sub.stop(); };
      } catch (err: any) {
        log.warn('NATS subscribe failed — falling back to in-process bus', { subject, error: err.message });
      }
    }

    // In-process fallback
    const parts = subject.split('.');
    if (parts[0] === 'vms' && parts[1] === 'events' && parts[2]) {
      const eventType = parts[2].toUpperCase() as VmsEventType;
      return vmsEventService.subscribe(eventType, async (evt) => {
        await handler({ subject, data: evt as unknown as T });
      });
    }
    return () => {};
  },

  /** Publish to DLQ (unprocessable messages). */
  async publishDLQ(originalSubject: string, data: unknown, reason: string): Promise<void> {
    await messageBusService.publish(`vms.dlq.${originalSubject.replace(/\./g, '_')}`, {
      originalSubject,
      data,
      reason,
      timestamp: new Date().toISOString(),
    });
  },

  health(): { status: 'ok' | 'degraded'; mode: 'nats' | 'in-process' } {
    return {
      status: natsAvailable ? 'ok' : 'degraded',
      mode: natsAvailable ? 'nats' : 'in-process',
    };
  },

  async close(): Promise<void> {
    if (nc) await nc.drain();
  },
};

// Initialise on module load (non-blocking)
initNats().catch(() => {});
