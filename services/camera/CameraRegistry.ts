/**
 * Sentinel VMS — Camera Registry (Main Orchestrator)
 *
 * The single source of truth for all camera state in the system.
 * Every camera must be registered here before any other module can interact with it.
 *
 * Responsibilities:
 *   • Camera registration and removal
 *   • Connection lifecycle management
 *   • Reconnect strategy (via ReconnectEngine)
 *   • Health monitoring (via HealthMonitor)
 *   • Stream management (via StreamManager)
 *   • Snapshot management (via SnapshotManager)
 *   • Capability discovery and metadata management
 *   • Status monitoring and statistics
 *   • Network device discovery (WS-Discovery + port sweep)
 *   • Bootstrap from Firestore on startup
 *
 * No UI code. No AI code.
 */

import net from 'net';
import { EventEmitter } from 'events';
import { db } from '../firestoreService';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { vmsEventService } from '../vmsEventService';
import { credentialVault } from './CredentialVault';
import { reconnectEngine } from './ReconnectEngine';
import { healthMonitor } from './HealthMonitor';
import { streamManager } from './StreamManager';
import { snapshotManager } from './SnapshotManager';
import { diagnosticsEngine, DiagnosticTarget } from './DiagnosticsEngine';
import { playbackEngine } from './PlaybackEngine';
import {
  CameraCapabilities,
  CameraConfig,
  CameraHealth,
  CameraState,
  DeviceDetails,
  PtzCommand,
  StreamProfile,
} from './interfaces';

export interface CameraRegistration {
  config: CameraConfig;
  registeredAt: string;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  capabilities: CameraCapabilities | null;
  metadata: DeviceDetails | null;
  reconnectCount: number;
  isStreaming: boolean;
}

export interface CameraStatusReport {
  id: string;
  name: string;
  state: CameraState;
  healthScore: number;
  isStreaming: boolean;
  fps: number;
  resolution: string;
  bitrateBps: number;
  latencyMs: number;
  reconnectCount: number;
  lastActiveAt: string | null;
  recordingStatus: string;
}

export interface NetworkDiscoveryResult {
  ip: string;
  port: number;
  guessedVendor: string;
  suggestedConfig: Partial<CameraConfig>;
}

const CAMERAS_COLLECTION = 'cameras';

class CameraRegistry extends EventEmitter {
  private static instance: CameraRegistry;
  private registrations: Map<string, CameraRegistration> = new Map();
  private bootstrapped = false;

  private constructor() {
    super();
    this.setMaxListeners(512);
  }

  public static getInstance(): CameraRegistry {
    if (!CameraRegistry.instance) {
      CameraRegistry.instance = new CameraRegistry();
    }
    return CameraRegistry.instance;
  }

  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  /**
   * Load all cameras from Firestore and attempt connections.
   * Call once on server startup.
   */
  public async bootstrap(): Promise<void> {
    if (this.bootstrapped) return;
    this.bootstrapped = true;

    try {
      const snap = await getDocs(collection(db, CAMERAS_COLLECTION));
      const cameras = snap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as CameraConfig[];

      for (const cam of cameras) {
        // Non-blocking — failures do not abort other cameras
        this.register(cam).catch(() => {});
      }
    } catch {
      // Firestore unavailable — start without persisted cameras
    }
  }

  // ─── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a camera and attempt to connect it.
   * If the camera is already registered, it is re-connected.
   */
  public async register(config: CameraConfig): Promise<CameraRegistration> {
    // Deregister first to ensure clean state
    if (this.registrations.has(config.id)) {
      await this.deregister(config.id);
    }

    // Store credentials securely
    if (config.encryptedPassword || config.username) {
      await credentialVault.store(
        config.id,
        config.username,
        config.encryptedPassword ?? '',
        config.streamUrl,
      );
    }

    const registration: CameraRegistration = {
      config,
      registeredAt: new Date().toISOString(),
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      capabilities: null,
      metadata: null,
      reconnectCount: 0,
      isStreaming: false,
    };

    this.registrations.set(config.id, registration);
    reconnectEngine.register(config.id);

    // Persist to Firestore
    await this.persistCamera(config);

    // Attempt connection
    await this.connect(config.id);

    // Register with health monitor
    healthMonitor.register(
      config.id,
      async (cameraId) => this.healthCheckProvider(cameraId),
      () => this.scheduleReconnect(config.id),
    );

    // Register snapshot provider
    snapshotManager.register(config.id, config.name, async () => {
      const driver = streamManager.getDriver(config.id);
      if (!driver) throw new Error(`No driver for camera ${config.id}`);
      return driver.getSnapshot();
    });

    this.emit('registered', { cameraId: config.id, name: config.name });

    return registration;
  }

  /**
   * Remove a camera from the registry and release all resources.
   */
  public async deregister(cameraId: string): Promise<void> {
    const registration = this.registrations.get(cameraId);
    if (!registration) return;

    reconnectEngine.cancelReconnect(cameraId);
    healthMonitor.unregister(cameraId);
    snapshotManager.unregister(cameraId);

    await streamManager.closeStream(cameraId).catch(() => {});

    this.registrations.delete(cameraId);

    vmsEventService.emit('CAMERA_DISCONNECTED', 'CameraRegistry', {
      cameraId,
      msg: `Camera ${cameraId} deregistered and removed from registry.`,
    }, 'INFO');

    this.emit('deregistered', { cameraId });
  }

  // ─── Connection management ─────────────────────────────────────────────────

  public async connect(cameraId: string): Promise<void> {
    const reg = this.registrations.get(cameraId);
    if (!reg) throw new Error(`Camera ${cameraId} not registered`);

    try {
      await streamManager.openStream(reg.config, 'MAIN');
      reg.lastConnectedAt = new Date().toISOString();
      reg.isStreaming = true;
      reconnectEngine.onReconnectSuccess(cameraId);

      // Discover capabilities asynchronously
      this.discoverCapabilities(cameraId);

      await this.persistStatus(cameraId, 'ONLINE');
      this.emit('connected', { cameraId });
    } catch (err: any) {
      reg.isStreaming = false;
      reg.lastDisconnectedAt = new Date().toISOString();
      await this.persistStatus(cameraId, 'OFFLINE');
      throw err;
    }
  }

  public async disconnect(cameraId: string): Promise<void> {
    const reg = this.registrations.get(cameraId);
    if (!reg) return;

    reconnectEngine.cancelReconnect(cameraId);
    await streamManager.closeStream(cameraId);

    reg.isStreaming = false;
    reg.lastDisconnectedAt = new Date().toISOString();
    await this.persistStatus(cameraId, 'OFFLINE');
    this.emit('disconnected', { cameraId });
  }

  public async reconnect(cameraId: string): Promise<void> {
    await this.disconnect(cameraId);
    await this.connect(cameraId);
  }

  private scheduleReconnect(cameraId: string): void {
    const reg = this.registrations.get(cameraId);
    if (!reg) return;

    reconnectEngine.scheduleReconnect(
      cameraId,
      async () => {
        reg.reconnectCount++;
        await this.connect(cameraId);
      },
    );
  }

  // ─── Capabilities & metadata ───────────────────────────────────────────────

  private async discoverCapabilities(cameraId: string): Promise<void> {
    const driver = streamManager.getDriver(cameraId);
    const reg = this.registrations.get(cameraId);
    if (!driver || !reg) return;

    try {
      const [caps, meta] = await Promise.allSettled([
        driver.getCapabilities(),
        driver.getMetadata(),
      ]);
      if (caps.status === 'fulfilled') reg.capabilities = caps.value;
      if (meta.status === 'fulfilled') reg.metadata = meta.value;
    } catch {
      // Non-fatal
    }
  }

  public async getCapabilities(cameraId: string): Promise<CameraCapabilities | null> {
    const reg = this.registrations.get(cameraId);
    if (!reg) return null;
    if (!reg.capabilities) await this.discoverCapabilities(cameraId);
    return reg.capabilities;
  }

  public async getMetadata(cameraId: string): Promise<DeviceDetails | null> {
    const reg = this.registrations.get(cameraId);
    if (!reg) return null;
    if (!reg.metadata) await this.discoverCapabilities(cameraId);
    return reg.metadata;
  }

  // ─── Status & health ───────────────────────────────────────────────────────

  public getStatus(cameraId: string): CameraStatusReport | null {
    const reg = this.registrations.get(cameraId);
    if (!reg) return null;

    const health = healthMonitor.getHealth(cameraId);
    const streamStats = streamManager.getStats(cameraId);

    return {
      id: cameraId,
      name: reg.config.name,
      state: health?.state ?? (reg.isStreaming ? 'STREAMING' : 'DISCONNECTED'),
      healthScore: health?.score ?? 0,
      isStreaming: reg.isStreaming,
      fps: streamStats?.fpsSmoothed ?? health?.fps ?? 0,
      resolution: streamStats?.resolution ?? health?.resolution ?? '0x0',
      bitrateBps: (streamStats?.bandwidthKbps ?? 0) * 1024,
      latencyMs: health?.latencyMs ?? 0,
      reconnectCount: reg.reconnectCount,
      lastActiveAt: reg.lastConnectedAt,
      recordingStatus: health?.recordingStatus ?? 'IDLE',
    };
  }

  public getAllStatuses(): CameraStatusReport[] {
    return Array.from(this.registrations.keys())
      .map(id => this.getStatus(id))
      .filter((s): s is CameraStatusReport => s !== null);
  }

  private async healthCheckProvider(cameraId: string): Promise<CameraHealth> {
    const driver = streamManager.getDriver(cameraId);
    if (!driver) {
      return {
        state: 'OFFLINE',
        latencyMs: 9999,
        packetLossPct: 100,
        bandwidthBps: 0,
        fps: 0,
        resolution: '0x0',
        codec: 'H264',
        recordingStatus: 'ERROR',
        lastActive: new Date().toISOString(),
      };
    }
    return driver.healthCheck();
  }

  // ─── Diagnostics ───────────────────────────────────────────────────────────

  public async runDiagnostics(cameraId: string) {
    const reg = this.registrations.get(cameraId);
    if (!reg) throw new Error(`Camera ${cameraId} not registered`);

    const { config } = reg;
    const target: DiagnosticTarget = {
      cameraId: config.id,
      ip: config.ip,
      rtspPort: config.rtspPort,
      onvifPort: config.onvifPort,
      httpPort: config.port,
      username: config.username,
      encryptedPassword: config.encryptedPassword,
      streamUrl: config.streamUrl,
    };

    return diagnosticsEngine.run(target);
  }

  // ─── PTZ ──────────────────────────────────────────────────────────────────

  public async ptzControl(cameraId: string, command: PtzCommand): Promise<void> {
    const driver = streamManager.getDriver(cameraId);
    if (!driver) throw new Error(`No active driver for camera ${cameraId}`);
    await driver.ptzControl(command);
  }

  // ─── Snapshot ─────────────────────────────────────────────────────────────

  public async takeSnapshot(cameraId: string, trigger: 'MANUAL' | 'EVENT' = 'MANUAL') {
    if (trigger === 'MANUAL') return snapshotManager.takeManualSnapshot(cameraId);
    return snapshotManager.takeEventSnapshot(cameraId, 'API_TRIGGER');
  }

  public async scheduleSnapshots(cameraId: string, intervalMs: number): Promise<void> {
    snapshotManager.scheduleSnapshots(cameraId, intervalMs);
  }

  // ─── Recording ────────────────────────────────────────────────────────────

  public async startRecording(cameraId: string, _mode: string = 'MANUAL'): Promise<void> {
    const reg = this.registrations.get(cameraId);
    if (!reg) throw new Error(`Camera ${cameraId} not registered`);
    vmsEventService.emit('RECORDING_STARTED', 'CameraRegistry', {
      cameraId,
      cameraName: reg.config.name,
      mode: _mode,
      startTime: new Date().toISOString(),
    }, 'INFO');
  }

  public async stopRecording(cameraId: string): Promise<void> {
    vmsEventService.emit('RECORDING_STOPPED', 'CameraRegistry', {
      cameraId,
      stopTime: new Date().toISOString(),
    }, 'INFO');
  }

  // ─── Playback ─────────────────────────────────────────────────────────────

  public async createPlaybackSession(cameraId: string, startMs: number, endMs: number) {
    return playbackEngine.createSession(cameraId, startMs, endMs);
  }

  // ─── Network discovery ────────────────────────────────────────────────────

  /**
   * Sweep a subnet for camera devices using TCP port probing.
   * WS-Discovery requires local network access — not available in cloud environments.
   */
  public async discoverNetworkDevices(
    subnetPrefix: string,
    onProgress?: (found: number, total: number) => void,
  ): Promise<NetworkDiscoveryResult[]> {
    const discovered: NetworkDiscoveryResult[] = [];
    const portSweepList = [80, 554, 8000, 3702, 8080];
    const total = 254;
    let checked = 0;

    const sweepTasks = Array.from({ length: 254 }, (_, i) => i + 1).map(i => async () => {
      const ip = `${subnetPrefix}.${i}`;
      const openPort = await this.probePort(ip, portSweepList);
      checked++;
      if (openPort > 0) {
        const guessedVendor = this.guessVendor(openPort);
        discovered.push({
          ip,
          port: openPort,
          guessedVendor,
          suggestedConfig: {
            id: `discovered_${ip.replace(/\./g, '_')}`,
            name: `${guessedVendor} @ ${ip}`,
            ip,
            port: openPort === 3702 ? 80 : openPort,
            rtspPort: 554,
            onvifPort: openPort === 3702 ? 80 : openPort,
            username: 'admin',
            streamUrl: `rtsp://${ip}:554/Streaming/Channels/101`,
            type: guessedVendor,
            protocol: 'ONVIF_S',
            status: 'OFFLINE',
          },
        });
      }
      onProgress?.(checked, total);
    });

    // Run all 254 checks in parallel
    await Promise.allSettled(sweepTasks.map(t => t()));

    vmsEventService.emit('CAMERA_CONNECTED', 'NetworkDiscovery', {
      subnet: subnetPrefix,
      discovered: discovered.length,
    }, 'INFO');

    return discovered;
  }

  private probePort(ip: string, ports: number[]): Promise<number> {
    return new Promise((resolve) => {
      let resolved = false;
      let completed = 0;

      for (const port of ports) {
        const sock = new net.Socket();
        sock.setTimeout(200);
        sock.connect(port, ip, () => {
          sock.destroy();
          if (!resolved) {
            resolved = true;
            resolve(port);
          }
        });
        const finish = () => {
          sock.destroy();
          completed++;
          if (completed === ports.length && !resolved) resolve(0);
        };
        sock.on('error', finish);
        sock.on('timeout', finish);
      }
    });
  }

  private guessVendor(port: number): string {
    if (port === 8000) return 'Hikvision';
    if (port === 3702) return 'Dahua';
    if (port === 80) return 'Generic ONVIF';
    return 'Unknown IP Camera';
  }

  // ─── Statistics ───────────────────────────────────────────────────────────

  public getSystemStats(): {
    totalRegistered: number;
    totalStreaming: number;
    totalOffline: number;
    avgHealthScore: number;
    activeStreams: number;
    queuedFrames: number;
  } {
    const all = this.getAllStatuses();
    const streaming = all.filter(s => s.isStreaming).length;
    const avgScore = all.length > 0
      ? Math.round(all.reduce((sum, s) => sum + s.healthScore, 0) / all.length)
      : 0;

    return {
      totalRegistered: all.length,
      totalStreaming: streaming,
      totalOffline: all.length - streaming,
      avgHealthScore: avgScore,
      activeStreams: streamManager.activeStreamCount(),
      queuedFrames: 0,
    };
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private async persistCamera(config: CameraConfig): Promise<void> {
    try {
      await setDoc(doc(db, CAMERAS_COLLECTION, config.id), {
        ...config,
        lastActive: new Date().toISOString(),
      }, { merge: true });
    } catch {
      // Firestore unavailable
    }
  }

  private async persistStatus(cameraId: string, status: 'ONLINE' | 'OFFLINE'): Promise<void> {
    try {
      await updateDoc(doc(db, CAMERAS_COLLECTION, cameraId), {
        status,
        lastActive: new Date().toISOString(),
      });
    } catch {
      // Document may not exist yet
    }
  }

  // ─── Lookups ──────────────────────────────────────────────────────────────

  public getRegistration(cameraId: string): CameraRegistration | null {
    return this.registrations.get(cameraId) ?? null;
  }

  public getAllRegistrations(): CameraRegistration[] {
    return Array.from(this.registrations.values());
  }

  public isRegistered(cameraId: string): boolean {
    return this.registrations.has(cameraId);
  }

  // ─── Shutdown ─────────────────────────────────────────────────────────────

  public async shutdown(): Promise<void> {
    healthMonitor.shutdown();
    await streamManager.shutdown();
    this.registrations.clear();
  }
}

export const cameraRegistry = CameraRegistry.getInstance();
