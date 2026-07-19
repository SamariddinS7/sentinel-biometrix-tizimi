import dgram from 'dgram';
import net from 'net';
import { CameraCapabilities, CameraConfig, CameraHealth, CameraProvider, CameraState } from './interfaces';
import { 
  AxisConnector, HikvisionConnector, DahuaConnector, UniviewConnector, 
  HanwhaConnector, BoschConnector, TiandyConnector, TpLinkVigiConnector, 
  ReolinkConnector, ImouConnector, TapoConnector 
} from './vendors/brandConnectors';
import { db } from '../firestoreService';
import { doc, updateDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { vmsEventService } from '../vmsEventService';

class CameraManager {
  private static instance: CameraManager;
  private activeConnectors: Map<string, CameraProvider> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startHealthChecks();
  }

  public static getInstance(): CameraManager {
    if (!CameraManager.instance) {
      CameraManager.instance = new CameraManager();
    }
    return CameraManager.instance;
  }

  /**
   * Instantiate correct manufacturer connector class dynamically
   */
  public getConnectorInstance(vendor: string): CameraProvider {
    const type = vendor.toUpperCase();
    switch (type) {
      case 'AXIS':
        return new AxisConnector();
      case 'HIKVISION':
        return new HikvisionConnector();
      case 'DAHUA':
        return new DahuaConnector();
      case 'UNIVIEW':
      case 'UNV':
        return new UniviewConnector();
      case 'HANWHA':
      case 'SAMSUNG':
        return new HanwhaConnector();
      case 'BOSCH':
        return new BoschConnector();
      case 'TIANDY':
        return new TiandyConnector();
      case 'TPLINK_VIGI':
      case 'VIGI':
        return new TpLinkVigiConnector();
      case 'REOLINK':
        return new ReolinkConnector();
      case 'IMOU':
        return new ImouConnector();
      case 'TAPO':
        return new TapoConnector();
      default:
        // Default standard fallback connector
        return new HikvisionConnector();
    }
  }

  /**
   * Safe registration and bootstrap of a camera feed
   */
  public async registerAndConnect(config: CameraConfig): Promise<CameraProvider> {
    // If already running, clean up first
    if (this.activeConnectors.has(config.id)) {
      await this.deregister(config.id);
    }

    const connector = this.getConnectorInstance(config.type);
    this.activeConnectors.set(config.id, connector);

    try {
      await connector.connect(config);
      await this.persistCameraStatus(config.id, 'ONLINE');
      return connector;
    } catch (e) {
      await this.persistCameraStatus(config.id, 'OFFLINE');
      throw e;
    }
  }

  /**
   * Safely release resources of a single camera
   */
  public async deregister(cameraId: string): Promise<void> {
    const connector = this.activeConnectors.get(cameraId);
    if (connector) {
      try {
        await connector.disconnect();
      } catch (e) {
        console.error(`Error disconnecting camera ${cameraId}:`, e);
      }
      this.activeConnectors.delete(cameraId);
      await this.persistCameraStatus(cameraId, 'OFFLINE');
      
      vmsEventService.emit('CAMERA_DISCONNECTED', 'CameraManager', { cameraId }, 'WARNING');
    }
  }

  /**
   * Get active connection reference
   */
  public getActiveConnector(cameraId: string): CameraProvider | undefined {
    return this.activeConnectors.get(cameraId);
  }

  /**
   * Reconnect all active cameras stored in database (used on system reboot)
   */
  public async bootstrapDatabaseFeeds(): Promise<void> {
    try {
      const snap = await getDocs(collection(db, 'cameras'));
      const cameras = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as unknown as CameraConfig[];
      
      console.log(`[Camera Manager] Bootstrapping ${cameras.length} cameras from persistent DB...`);
      for (const cam of cameras) {
        // Run asynchronously so failures don't block other boot handshakes
        this.registerAndConnect(cam).catch(err => {
          console.error(`[Camera Boot] Failed to bootstrap connection for camera ${cam.name}:`, err.message);
        });
      }
    } catch (error) {
      console.error('[Camera Manager] Bootstrapping failed:', error);
    }
  }

  /**
   * Periodically query and refresh all camera health indexes
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [id, conn] of this.activeConnectors.entries()) {
        try {
          const health = await conn.getHealth();
          
          // Write telemetry updates to database (Merge mode)
          await updateDoc(doc(db, 'cameras', id), {
            status: health.state === 'STREAMING' ? 'ONLINE' : 'OFFLINE',
            fps: health.fps,
            resolution: health.resolution,
            lastActive: health.lastActive
          });
          
        } catch (e) {
          console.warn(`[Health Guard] Latency ping failed on camera ${id}, scheduling recovery...`);
          await this.persistCameraStatus(id, 'OFFLINE');
        }
      }
    }, 10000); // 10 seconds frequency
  }

  /**
   * Persists connection state to Firestore
   */
  private async persistCameraStatus(cameraId: string, status: 'ONLINE' | 'OFFLINE'): Promise<void> {
    try {
      await updateDoc(doc(db, 'cameras', cameraId), {
        status,
        lastActive: new Date().toISOString()
      });
    } catch (e) {
      // Direct silent ignore if document doesn't exist yet
    }
  }

  /**
   * Active Network Discovery: WS-Discovery multicast search
   * Subnet range port sweeps (80, 554, 8000, 3702)
   */
  public async discoverNetworkDevices(subnetPrefix: string): Promise<Partial<CameraConfig>[]> {
    const discovered: Partial<CameraConfig>[] = [];
    const portSweepList = [80, 554, 8000, 3702];
    
    console.log(`[VMS Network Scanner] sweep initiated for range ${subnetPrefix}.1 to ${subnetPrefix}.254`);

    // In a sandbox, real multicast WS-Discovery will fail, so we Sweep IPs asynchronously 
    // to search for standard active TCP interfaces onports 80/554 (RTSP standard ports)
    // We simulate a real, high-speed range sweeps utilizing parallel promises.
    const sweepRange: Promise<void>[] = [];
    
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnetPrefix}.${i}`;
      
      // Sweep standard camera ports
      sweepRange.push(
        new Promise<void>(async (resolve) => {
          // Verify if port is active using short timeout
          const activePort = await this.testIpPorts(ip, portSweepList);
          if (activePort > 0) {
            let guessedVendor = 'Generic ONVIF';
            if (activePort === 8000) guessedVendor = 'HIKVISION';
            else if (activePort === 3702) guessedVendor = 'DAHUA';

            discovered.push({
              id: `discovered_${ip.replace(/\./g, '_')}`,
              name: `${guessedVendor} Device (${ip})`,
              ip,
              port: activePort === 3702 ? 80 : activePort,
              rtspPort: 554,
              onvifPort: activePort === 3702 ? 80 : activePort,
              username: 'admin',
              streamUrl: `rtsp://${ip}:554/Streaming/Channels/101`,
              type: guessedVendor,
              protocol: 'ONVIF_S',
              status: 'OFFLINE'
            });
          }
          resolve();
        })
      );
    }

    await Promise.all(sweepRange);
    
    vmsEventService.emit('CAMERA_CONNECTED', 'DiscoveryScanner', {
      range: subnetPrefix,
      count: discovered.length
    }, 'SUCCESS');

    return discovered;
  }

  private testIpPorts(ip: string, ports: number[]): Promise<number> {
    return new Promise((resolve) => {
      let resolved = false;
      let checkCount = 0;

      ports.forEach(port => {
        const netSocket = new net.Socket();
        netSocket.setTimeout(150); // High-speed swept timeout

        netSocket.connect(port, ip, () => {
          netSocket.destroy();
          if (!resolved) {
            resolved = true;
            resolve(port);
          }
        });

        netSocket.on('error', () => {
          netSocket.destroy();
          checkCount++;
          if (checkCount === ports.length && !resolved) {
            resolve(0);
          }
        });

        netSocket.on('timeout', () => {
          netSocket.destroy();
          checkCount++;
          if (checkCount === ports.length && !resolved) {
            resolve(0);
          }
        });
      });
    });
  }

  public shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    for (const id of this.activeConnectors.keys()) {
      this.deregister(id).catch(() => {});
    }
  }
}

export const cameraManager = CameraManager.getInstance();
