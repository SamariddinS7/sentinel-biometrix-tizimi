/**
 * Sentinel VMS — RTSP Connection Pool
 *
 * Manages a pool of RTSP sessions, one per (cameraId, profile) pair.
 * Implements the RTSP/1.0 protocol handshake (OPTIONS → DESCRIBE → SETUP → PLAY)
 * over a persistent TCP socket with Digest-Auth support.
 *
 * This is the ONLY place in the system that opens RTSP connections.
 * All drivers MUST go through this pool — never open raw sockets elsewhere.
 */

import net from 'net';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { CameraConfig, CodecType, StreamProfile } from './interfaces';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface StreamStats {
  fps: number;
  bitrateKbps: number;
  packetLossPct: number;
  latencyMs: number;
  resolution: string;
  codec: CodecType;
}

// ─── RTSP Session ─────────────────────────────────────────────────────────────

export class RtspSession extends EventEmitter {
  private socket: net.Socket | null = null;
  private cSeq = 1;
  private sessionId = '';
  private isConnected = false;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private statsTimer: NodeJS.Timeout | null = null;
  private authChallenge: string | null = null;

  // Real-time telemetry counters
  private bytesReceived = 0;
  private packetsReceived = 0;
  private lastPacketSeq = -1;
  private packetsDropped = 0;
  private latencyBuffer: number[] = [];
  private lastStatTime = Date.now();

  private currentStats: StreamStats = {
    fps: 0,
    bitrateKbps: 0,
    packetLossPct: 0,
    latencyMs: 0,
    resolution: '1920x1080',
    codec: 'H264',
  };

  constructor(
    public readonly cameraId: string,
    public readonly config: CameraConfig,
    public readonly profile: StreamProfile = 'MAIN',
  ) {
    super();
  }

  // ─── Connect ────────────────────────────────────────────────────────────────

  public async connect(): Promise<void> {
    this.disconnect(); // Guard: clean any active handles

    return new Promise((resolve, reject) => {
      const host = this.config.ip;
      const port = this.config.rtspPort || 554;

      this.socket = new net.Socket();
      this.socket.setTimeout(8000);

      this.socket.connect(port, host, async () => {
        this.isConnected = true;

        try {
          // RTSP handshake: OPTIONS → DESCRIBE → SETUP → PLAY
          await this.sendOptions();
          await this.sendDescribe();
          await this.sendSetup();
          await this.sendPlay();

          this.startKeepAlive();
          this.startStatsCollection();
          resolve();
        } catch (err) {
          this.disconnect();
          reject(err);
        }
      });

      this.socket.on('data', (data: Buffer) => {
        this.bytesReceived += data.length;
        this.processRtpData(data);
      });

      this.socket.on('error', (err: Error) => {
        this.emit('error', err);
        this.disconnect();
      });

      this.socket.on('timeout', () => {
        this.socket?.destroy();
        reject(new Error(`RTSP TCP timeout connecting to ${host}:${port}`));
      });

      this.socket.on('close', () => {
        if (this.isConnected) {
          this.isConnected = false;
          this.emit('disconnected');
        }
      });
    });
  }

  // ─── Disconnect ─────────────────────────────────────────────────────────────

  public disconnect(): void {
    if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
    if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = null; }
    if (this.socket) {
      try { this.socket.destroy(); } catch { /* best-effort */ }
      this.socket = null;
    }
    this.isConnected = false;
    this.sessionId = '';
    this.cSeq = 1;
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  public getStats(): StreamStats {
    return { ...this.currentStats };
  }

  public isActive(): boolean {
    return this.isConnected && this.socket !== null && !this.socket.destroyed;
  }

  // ─── RTSP protocol methods ──────────────────────────────────────────────────

  private async sendOptions(): Promise<void> {
    const response = await this.sendRequest('OPTIONS', this.config.streamUrl);
    // OPTIONS response may include Public: DESCRIBE, SETUP, PLAY — we just check 200
    if (!response.includes('200 OK')) {
      throw new Error(`RTSP OPTIONS failed: ${response.split('\r\n')[0]}`);
    }
  }

  private async sendDescribe(): Promise<void> {
    const response = await this.sendRequest('DESCRIBE', this.config.streamUrl, {
      Accept: 'application/sdp',
    });

    if (response.includes('401')) {
      // Parse WWW-Authenticate and retry with credentials
      const wwwAuth = this.extractHeader(response, 'WWW-Authenticate');
      this.authChallenge = wwwAuth;
      const authedResponse = await this.sendRequest('DESCRIBE', this.config.streamUrl, {
        Accept: 'application/sdp',
        Authorization: this.buildAuth('DESCRIBE', this.config.streamUrl),
      });
      this.parseSdp(authedResponse);
    } else if (!response.includes('200 OK')) {
      throw new Error(`RTSP DESCRIBE failed: ${response.split('\r\n')[0]}`);
    } else {
      this.parseSdp(response);
    }
  }

  private async sendSetup(): Promise<void> {
    const transport = this.config.transport === 'UDP'
      ? 'RTP/AVP;unicast;client_port=8000-8001'
      : 'RTP/AVP/TCP;unicast;interleaved=0-1';

    const response = await this.sendRequest('SETUP', this.config.streamUrl, {
      Transport: transport,
    });

    if (!response.includes('200 OK')) {
      throw new Error(`RTSP SETUP failed: ${response.split('\r\n')[0]}`);
    }

    const sessionHeader = this.extractHeader(response, 'Session');
    this.sessionId = sessionHeader.split(';')[0].trim();
  }

  private async sendPlay(): Promise<void> {
    const response = await this.sendRequest('PLAY', this.config.streamUrl, {
      Range: 'npt=0.000-',
      Session: this.sessionId,
    });

    if (!response.includes('200 OK')) {
      throw new Error(`RTSP PLAY failed: ${response.split('\r\n')[0]}`);
    }

    // Parse RTP-Info header for initial sequence numbers
    const rtpInfo = this.extractHeader(response, 'RTP-Info');
    if (rtpInfo) {
      const seqMatch = rtpInfo.match(/seq=(\d+)/);
      if (seqMatch) this.lastPacketSeq = parseInt(seqMatch[1], 10) - 1;
    }
  }

  private startKeepAlive(): void {
    // RTSP keep-alive via OPTIONS every 30 seconds
    this.keepAliveTimer = setInterval(async () => {
      try {
        await this.sendRequest('OPTIONS', this.config.streamUrl, {
          Session: this.sessionId,
        });
      } catch {
        this.emit('error', new Error('RTSP keep-alive failed'));
      }
    }, 30_000);
  }

  private startStatsCollection(): void {
    this.statsTimer = setInterval(() => {
      const now = Date.now();
      const elapsedSec = (now - this.lastStatTime) / 1000;
      if (elapsedSec <= 0) return;

      this.currentStats.bitrateKbps = Math.round((this.bytesReceived * 8) / (elapsedSec * 1000));
      this.currentStats.packetLossPct = this.packetsReceived > 0
        ? Math.min(100, Math.round((this.packetsDropped / this.packetsReceived) * 100 * 10) / 10)
        : 0;

      const avgLatency = this.latencyBuffer.length > 0
        ? this.latencyBuffer.reduce((a, b) => a + b, 0) / this.latencyBuffer.length
        : 0;
      this.currentStats.latencyMs = Math.round(avgLatency);

      this.bytesReceived = 0;
      this.packetsDropped = 0;
      this.latencyBuffer = [];
      this.lastStatTime = now;
    }, 1000);
  }

  // ─── RTP processing ─────────────────────────────────────────────────────────

  private processRtpData(data: Buffer): void {
    if (data.length < 4) return;

    // Interleaved RTP over TCP: starts with '$' (0x24)
    if (data[0] === 0x24) {
      const channel = data[1];
      if (channel !== 0) return; // Ignore RTCP on channel 1

      const rtpPayload = data.slice(4);
      this.processRtpPacket(rtpPayload);
    }
  }

  private processRtpPacket(rtp: Buffer): void {
    if (rtp.length < 12) return;

    const seq = rtp.readUInt16BE(2);
    const timestamp = rtp.readUInt32BE(4);

    if (this.lastPacketSeq >= 0) {
      const expected = (this.lastPacketSeq + 1) & 0xFFFF;
      if (seq !== expected) {
        const lost = (seq - expected + 65536) & 0xFFFF;
        this.packetsDropped += Math.min(lost, 100); // Cap to avoid wrap-around inflation
      }
    }

    this.packetsReceived++;
    this.lastPacketSeq = seq;

    // Approximate latency from RTP timestamp (90kHz clock for video)
    const rtpTimeMs = (timestamp / 90); // ms
    const wallTimeMs = Date.now() % (0xFFFFFFFF / 90); // rolling window
    const latency = Math.abs(wallTimeMs - rtpTimeMs) % 1000; // Cap at 1s
    if (latency < 500) this.latencyBuffer.push(latency);

    this.emit('rtpPacket', rtp);
    this.emit('frame', rtp.slice(12)); // RTP payload (NAL unit or JPEG fragment)
  }

  // ─── SDP parsing ────────────────────────────────────────────────────────────

  private parseSdp(response: string): void {
    // Extract codec from SDP a=rtpmap or a=fmtp
    if (/H265|H\.265|HEVC/i.test(response)) {
      this.currentStats.codec = 'H265';
    } else if (/H264|H\.264|AVC/i.test(response)) {
      this.currentStats.codec = 'H264';
    } else if (/JPEG|MJPEG/i.test(response)) {
      this.currentStats.codec = 'MJPEG';
    }

    // a=framesize: width-height or x-resolution in SDP
    const fsMatch = response.match(/a=framesize:\d+ (\d+)-(\d+)/);
    if (fsMatch) {
      this.currentStats.resolution = `${fsMatch[1]}x${fsMatch[2]}`;
    }

    // a=framerate: fps
    const frMatch = response.match(/a=framerate:([\d.]+)/);
    if (frMatch) {
      this.currentStats.fps = parseFloat(frMatch[1]);
    }
  }

  // ─── Low-level send/receive ─────────────────────────────────────────────────

  private sendRequest(
    method: string,
    url: string,
    headers: Record<string, string> = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(new Error('RTSP socket not connected'));
        return;
      }

      const seq = this.cSeq++;
      const request = [
        `${method} ${url} RTSP/1.0`,
        `CSeq: ${seq}`,
        `User-Agent: Sentinel-VMS/3.0`,
        ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
        '',
        '',
      ].join('\r\n');

      let response = '';
      const responseHandler = (data: Buffer) => {
        response += data.toString('utf8');
        // RTSP response ends with \r\n\r\n
        if (response.includes('\r\n\r\n')) {
          this.socket?.removeListener('data', responseHandler);
          clearTimeout(timeout);
          resolve(response);
        }
      };

      const timeout = setTimeout(() => {
        this.socket?.removeListener('data', responseHandler);
        reject(new Error(`RTSP ${method} timeout`));
      }, 8000);

      this.socket.on('data', responseHandler);
      this.socket.write(request);
    });
  }

  private buildAuth(method: string, url: string): string {
    if (!this.authChallenge) return '';

    const realm = this.authChallenge.match(/realm="([^"]+)"/)?.[1] ?? '';
    const nonce = this.authChallenge.match(/nonce="([^"]+)"/)?.[1] ?? '';
    const username = this.config.username;
    const password = this.config.encryptedPassword ?? '';

    // Digest authentication (RFC 2617)
    const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
    const ha2 = crypto.createHash('md5').update(`${method}:${url}`).digest('hex');
    const response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');

    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${url}", response="${response}"`;
  }

  private extractHeader(response: string, headerName: string): string {
    const regex = new RegExp(`^${headerName}:\\s*(.+)$`, 'mi');
    return response.match(regex)?.[1]?.trim() ?? '';
  }
}

// ─── RTSP Connection Pool ─────────────────────────────────────────────────────

class RtspConnectionPoolImpl {
  private sessions: Map<string, RtspSession> = new Map();

  private key(cameraId: string, profile: StreamProfile): string {
    return `${cameraId}::${profile}`;
  }

  /**
   * Return an existing session or create and connect a new one.
   */
  public async getOrCreateSession(
    cameraId: string,
    config: CameraConfig,
    profile: StreamProfile,
  ): Promise<RtspSession> {
    const k = this.key(cameraId, profile);
    const existing = this.sessions.get(k);
    if (existing && existing.isActive()) return existing;

    // Stale session — clean up before re-creating
    if (existing) {
      existing.disconnect();
      this.sessions.delete(k);
    }

    const session = new RtspSession(cameraId, config, profile);
    await session.connect();
    this.sessions.set(k, session);
    return session;
  }

  /**
   * Release a session, closing its TCP socket.
   */
  public releaseSession(cameraId: string, profile: StreamProfile): void {
    const k = this.key(cameraId, profile);
    const session = this.sessions.get(k);
    if (session) {
      session.disconnect();
      this.sessions.delete(k);
    }
  }

  public activeSessions(): number {
    return this.sessions.size;
  }
}

export const rtspConnectionPool = new RtspConnectionPoolImpl();
