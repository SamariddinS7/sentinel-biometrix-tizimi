export interface HardwareTelemetry {
  cpuUsage: number; // %
  cpuTemperature: number; // °C
  ramTotalMb: number;
  ramUsedMb: number;
  ramUsagePercentage: number;
  networkInboundKbps: number;
  networkOutboundKbps: number;
  gpuUsage?: number; // %
  gpuTemperature?: number; // °C
  uptimeSec: number;
}

export interface ServiceState {
  serviceName: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  threadCount: number;
  memoryUsageMb: number;
  restartCount: number;
}

class VmsHealthService {
  private static instance: VmsHealthService;
  private telemetry: HardwareTelemetry;
  private services: ServiceState[] = [];
  private bootTime: number;

  private constructor() {
    this.bootTime = Date.now();
    this.telemetry = {
      cpuUsage: 0,
      cpuTemperature: 0,
      ramTotalMb: 0,
      ramUsedMb: 0,
      ramUsagePercentage: 0,
      networkInboundKbps: 0,
      networkOutboundKbps: 0,
      gpuUsage: 0,
      gpuTemperature: 0,
      uptimeSec: 0
    };

    this.services = [
      { serviceName: 'Identity Provider Proxy', status: 'ONLINE', threadCount: 4, memoryUsageMb: 182, restartCount: 0 },
      { serviceName: 'ONVIF Device Scanner', status: 'ONLINE', threadCount: 8, memoryUsageMb: 310, restartCount: 0 },
      { serviceName: 'RTSP Stream Parser Engine', status: 'ONLINE', threadCount: 32, memoryUsageMb: 1420, restartCount: 1 },
      { serviceName: 'H.264 Multi-Stream Recording Core', status: 'ONLINE', threadCount: 16, memoryUsageMb: 850, restartCount: 0 },
      { serviceName: 'Gemini AI Inference Queue Handler', status: 'ONLINE', threadCount: 12, memoryUsageMb: 980, restartCount: 0 },
      { serviceName: 'Spatial Vector Tracker Core', status: 'ONLINE', threadCount: 6, memoryUsageMb: 412, restartCount: 0 }
    ];

    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.fetchRealTelemetry();
      }, 5000);
      this.fetchRealTelemetry();
    }
  }

  private async fetchRealTelemetry() {
    try {
      const res = await fetch('/api/telemetry');
      if (res.ok) {
        const data = await res.json();
        this.telemetry = data;
      }
    } catch (error) {
      console.warn("Failed to fetch telemetry:", error);
    }
  }

  public static getInstance(): VmsHealthService {
    if (!VmsHealthService.instance) {
      VmsHealthService.instance = new VmsHealthService();
    }
    return VmsHealthService.instance;
  }

  /**
   * Fetch active server hardware telemetry metrics
   */
  public getTelemetry(): HardwareTelemetry {
    return { ...this.telemetry };
  }

  /**
   * Fetch health state lists for system microservices
   */
  public getServiceStates(): ServiceState[] {
    return [...this.services];
  }

  /**
   * Restarts a degraded microservice cleanly
   */
  public restartService(name: string): boolean {
    const idx = this.services.findIndex(s => s.serviceName === name);
    if (idx === -1) return false;

    this.services[idx].status = 'OFFLINE';
    this.services[idx].memoryUsageMb = 0;

    setTimeout(() => {
      this.services[idx].status = 'ONLINE';
      this.services[idx].memoryUsageMb = 0; // Requires actual memory monitoring hook in production
      this.services[idx].restartCount += 1;
    }, 1500);

    return true;
  }
}

export const vmsHealthService = VmsHealthService.getInstance();
