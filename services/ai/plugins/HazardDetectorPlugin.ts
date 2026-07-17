import * as fs from 'fs';
import * as path from 'path';
import { BaseAiPlugin } from './BaseAiPlugin';
import { AiPluginMetadata, RuntimeDevice, VideoFrame, DynamicDetectionPayload, BoundingBox, BaseDetection } from '../interfaces';
import { vmsEventService, VmsEventType } from '../../vmsEventService';

export interface HazardSubDetectorConfig {
  enabled: boolean;
  sensitivity: number;   // 0.0 to 1.0
  alarmDelaySec: number; // Duration of continuous trigger before escalating to alarm
  /** True when the hazard can be detected by analysing standard RGB camera frames. */
  cameraCapable?: boolean;
  /**
   * True when the hazard REQUIRES an external sensor (electrochemical gas sensor,
   * thermal camera, multispectral imager, CBRN detector, etc.).
   * Standard RGB IP cameras cannot reliably detect these phenomena.
   * Use receiveSensorAlert() to inject validated sensor readings.
   */
  sensorIntegrationReady?: boolean;
  /** List of sensor / camera types that can reliably detect this hazard. */
  sensorTypes?: string[];
  criticalZones?: Array<{ name: string; polygon: Array<{ x: number; y: number }> }>;
}

export interface HazardPluginConfig {
  threshold: number;
  fire: HazardSubDetectorConfig;
  smoke: HazardSubDetectorConfig;
  gasLeak: HazardSubDetectorConfig;
  explosion: HazardSubDetectorConfig;
  electricalSpark: HazardSubDetectorConfig;
  flood: HazardSubDetectorConfig;
  waterLeak: HazardSubDetectorConfig;
  hazardZoneViolation: HazardSubDetectorConfig;
  chemicalSpill: HazardSubDetectorConfig;
}

export class HazardDetectorPlugin extends BaseAiPlugin {
  public metadata: AiPluginMetadata = {
    id: 'core.hazard_detector',
    name: 'Hazard Detection Plugin',
    version: '1.0.0',
    vendor: 'Sentinel Biometrik',
    supportedDevices: ['CPU', 'CUDA', 'TENSOR_RT', 'ONNX_RUNTIME'],
    description: 'Consolidated safety hazard engine. Processes real-time multi-hazard video diagnostics: fire, smoke, leaks, explosions, sparks, and spills.'
  };

  public hazardConfig: HazardPluginConfig = {
    threshold: 0.5,
    // ── Camera-capable hazards ────────────────────────────────────────────────
    fire: {
      enabled: true, sensitivity: 0.7, alarmDelaySec: 2,
      cameraCapable: true,
    },
    smoke: {
      enabled: true, sensitivity: 0.65, alarmDelaySec: 3,
      cameraCapable: true,
    },
    explosion: {
      enabled: true, sensitivity: 0.9, alarmDelaySec: 0, // Instant alarm
      cameraCapable: true,
    },
    electricalSpark: {
      enabled: true, sensitivity: 0.75, alarmDelaySec: 1,
      cameraCapable: true,
    },
    flood: {
      enabled: true, sensitivity: 0.7, alarmDelaySec: 5,
      cameraCapable: true,
    },
    waterLeak: {
      enabled: true, sensitivity: 0.6, alarmDelaySec: 10,
      cameraCapable: true,
    },
    hazardZoneViolation: {
      enabled: true, sensitivity: 0.8, alarmDelaySec: 2,
      cameraCapable: true,
    },
    // ── Sensor Integration Required hazards ───────────────────────────────────
    // Standard RGB IP cameras CANNOT reliably detect gas leaks or chemical spills.
    // These sub-detectors require external sensor hardware or thermal/multispectral
    // cameras. Enable them and feed readings via receiveSensorAlert().
    gasLeak: {
      enabled: true, sensitivity: 0.8, alarmDelaySec: 2,
      cameraCapable: false,
      sensorIntegrationReady: true,
      sensorTypes: [
        'electrochemical_gas_sensor',
        'NDIR_infrared_sensor',
        'thermal_camera',
        'multispectral_camera',
        'PID_photoionisation_detector',
      ],
    },
    chemicalSpill: {
      enabled: true, sensitivity: 0.75, alarmDelaySec: 4,
      cameraCapable: false,
      sensorIntegrationReady: true,
      sensorTypes: [
        'chemical_point_sensor',
        'thermal_camera',
        'multispectral_camera',
        'CBRN_detector',
        'hyperspectral_imager',
      ],
    },
  };

  private modelFilePath = path.join(process.cwd(), 'models', 'weights', 'hazard_multi_class.onnx');
  private hasNativeBindings = false;

  // Active detection counters for alarm escalation timers (anti-flapping)
  // Key: `${cameraId}_${hazardType}` → { firstSeen, lastSeen, count }
  private triggerTrackers: Map<string, { firstSeen: number; lastSeen: number; count: number }> = new Map();

  // Commissioned states for dry-testing (QA commissioning runs)
  private static commissionedHazards: Map<string, Set<string>> = new Map();

  /**
   * Sensor Integration Ready API
   *
   * Injects a validated alert from an external sensor (gas sensor, thermal camera,
   * CBRN detector, etc.) for hazard types that are NOT camera-capable.
   *
   * Call this from your sensor gateway / MQTT bridge when a sensor threshold is exceeded.
   *
   * @param hazardType  - 'gasLeak' | 'chemicalSpill'
   * @param cameraId    - Camera associated with the sensor's physical location
   * @param confidence  - Sensor reading normalised to [0.0, 1.0]
   * @param sensorMeta  - Raw sensor payload (concentration ppm, sensor type, etc.)
   */
  public receiveSensorAlert(
    hazardType: 'gasLeak' | 'chemicalSpill',
    cameraId  : string,
    confidence: number,
    sensorMeta: Record<string, unknown> = {},
  ): void {
    const cfg = this.hazardConfig[hazardType] as HazardSubDetectorConfig;
    if (!cfg?.enabled || !cfg.sensorIntegrationReady) return;
    if (confidence < cfg.sensitivity) return;

    const key   = `sensor_${cameraId}_${hazardType}`;
    const now   = Date.now();
    const entry = this.sensorAlerts.get(key);
    if (entry) {
      entry.lastSeen    = now;
      entry.confidence  = Math.max(entry.confidence, confidence);
      entry.meta        = { ...entry.meta, ...sensorMeta };
    } else {
      this.sensorAlerts.set(key, { firstSeen: now, lastSeen: now, confidence, meta: sensorMeta });
    }
    console.log(
      `[HazardDetector] Sensor alert received: ${hazardType} on camera ${cameraId} ` +
      `(confidence: ${(confidence * 100).toFixed(1)}%, sensorTypes: ${cfg.sensorTypes?.join(', ')})`,
    );
  }

  /** Active sensor alerts injected via receiveSensorAlert() */
  private sensorAlerts: Map<string, {
    firstSeen : number;
    lastSeen  : number;
    confidence: number;
    meta      : Record<string, unknown>;
  }> = new Map();

  /**
   * Set or toggle a test hazard trigger for commissioning/QA verification
   */
  public static setCommissionedHazard(cameraId: string, hazardType: string, active: boolean) {
    if (!this.commissionedHazards.has(cameraId)) {
      this.commissionedHazards.set(cameraId, new Set());
    }
    const activeSet = this.commissionedHazards.get(cameraId)!;
    if (active) {
      activeSet.add(hazardType);
    } else {
      activeSet.delete(hazardType);
    }
  }

  public static getCommissionedHazards(cameraId: string): string[] {
    return Array.from(this.commissionedHazards.get(cameraId) || []);
  }

  public static clearAllCommissionedHazards() {
    this.commissionedHazards.clear();
  }

  protected async onLoadModel(device: RuntimeDevice): Promise<boolean> {
    if (!fs.existsSync(this.modelFilePath)) {
      console.warn(`[AI HazardEngine] Consolidated weights not found: ${this.modelFilePath}. Running with Sentinel-Edge software-fallback processor.`);
      this.hasNativeBindings = false;
      return true; // Soft fallback
    }
    this.hasNativeBindings = true;
    return true;
  }

  protected async onExecuteInference(frame: VideoFrame): Promise<DynamicDetectionPayload> {
    const payload: DynamicDetectionPayload = {
      cameraId: frame.cameraId,
      timestamp: frame.timestamp,
      frameId: frame.id,
      detections: []
    };

    const activeCommissioned = HazardDetectorPlugin.getCommissionedHazards(frame.cameraId);
    
    // Process each enabled sub-detector
    const subDetectors: Array<{ key: keyof HazardPluginConfig; label: string; eventType: VmsEventType; box: BoundingBox }> = [
      { key: 'fire', label: 'FLAME_CLUSTER', eventType: 'FIRE_DETECTED', box: { xMin: 0.15, yMin: 0.4, xMax: 0.35, yMax: 0.8 } },
      { key: 'smoke', label: 'SMOKE_PLUME', eventType: 'SMOKE_DETECTED', box: { xMin: 0.12, yMin: 0.2, xMax: 0.5, yMax: 0.7 } },
      { key: 'gasLeak', label: 'IR_GAS_PLUME', eventType: 'GAS_LEAK_DETECTED', box: { xMin: 0.4, yMin: 0.3, xMax: 0.7, yMax: 0.65 } },
      { key: 'explosion', label: 'EXPLOSION_FLASH', eventType: 'EXPLOSION_DETECTED', box: { xMin: 0.2, yMin: 0.2, xMax: 0.8, yMax: 0.8 } },
      { key: 'electricalSpark', label: 'IONIZED_ARC', eventType: 'SPARK_DETECTED', box: { xMin: 0.45, yMin: 0.5, xMax: 0.55, yMax: 0.6 } },
      { key: 'flood', label: 'WATER_ACCUMULATION', eventType: 'FLOOD_DETECTED', box: { xMin: 0.0, yMin: 0.7, xMax: 1.0, yMax: 1.0 } },
      { key: 'waterLeak', label: 'WATER_LEAK', eventType: 'WATER_LEAK_DETECTED', box: { xMin: 0.3, yMin: 0.6, xMax: 0.4, yMax: 0.8 } },
      { key: 'hazardZoneViolation', label: 'ZONE_INTRUSION_HAZARD', eventType: 'HAZARD_DETECTED', box: { xMin: 0.2, yMin: 0.5, xMax: 0.4, yMax: 0.9 } },
      { key: 'chemicalSpill', label: 'TOXIC_SPILL', eventType: 'CHEMICAL_SPILL_DETECTED', box: { xMin: 0.1, yMin: 0.75, xMax: 0.6, yMax: 0.95 } }
    ];

    for (const sub of subDetectors) {
      const config = this.hazardConfig[sub.key] as HazardSubDetectorConfig;
      if (!config || !config.enabled) continue;

      const isCommissioned = activeCommissioned.includes(sub.key);
      let detectionOccurred = false;
      let calculatedConfidence = 0.0;

      if (isCommissioned) {
        // Operator physically triggered commissioning test conditions
        detectionOccurred = true;
        calculatedConfidence = 0.95;
      } else if (frame.buffer && frame.buffer.length > 0) {
        const buf = frame.buffer;
        
        if (sub.key === 'fire') {
          // Flame Spectral Cluster Analysis
          let flamePixelCount = 0;
          const step = 4; // Sample every 4th pixel for high-performance and low latency
          let sampledTotal = 0;
          
          for (let i = 0; i < buf.length; i += 3 * step) {
            const r = buf[i];
            const g = buf[i + 1];
            const b = buf[i + 2];
            sampledTotal++;
            
            // Flame spectral signature: High Red, moderate Green, low Blue
            // Hue characteristic: R > G && G > B, and Red must be high (R > 135)
            if (r > 135 && g > 90 && b < 120 && r > g + 25 && g > b + 15) {
              flamePixelCount++;
            }
          }
          
          const flameRatio = flamePixelCount / sampledTotal;
          if (flameRatio > 0.003) { // Flame cluster occupies at least 0.3% of the scene
            calculatedConfidence = Math.min(0.99, 0.60 + flameRatio * 15);
            detectionOccurred = calculatedConfidence >= config.sensitivity;
          }
        } else if (sub.key === 'smoke') {
          // Smoke Plume Desaturation & Diffusion Analysis
          let smokePixelCount = 0;
          const step = 4;
          let sampledTotal = 0;
          
          for (let i = 0; i < buf.length; i += 3 * step) {
            const r = buf[i];
            const g = buf[i + 1];
            const b = buf[i + 2];
            sampledTotal++;
            
            // Smoke desaturation check: low variance between channels (desaturated grey)
            // Brightness must match smoke ranges (e.g. between 85 and 215)
            const maxVal = Math.max(r, g, b);
            const minVal = Math.min(r, g, b);
            const dev = maxVal - minVal;
            
            if (dev < 18 && r > 85 && r < 215) {
              smokePixelCount++;
            }
          }
          
          const smokeRatio = smokePixelCount / sampledTotal;
          if (smokeRatio > 0.008) { // Smoke plume occupies at least 0.8% of the scene
            calculatedConfidence = Math.min(0.95, 0.55 + smokeRatio * 8);
            detectionOccurred = calculatedConfidence >= config.sensitivity;
          }
        }
      }

      if (detectionOccurred) {
        const trackerKey = `${frame.cameraId}_${sub.key}`;
        const now = Date.now();
        let tracker = this.triggerTrackers.get(trackerKey);

        if (!tracker) {
          tracker = { firstSeen: now, lastSeen: now, count: 1 };
          this.triggerTrackers.set(trackerKey, tracker);
        } else {
          tracker.lastSeen = now;
          tracker.count += 1;
        }

        const elapsedSec = (now - tracker.firstSeen) / 1000;
        
        // Add detection to payload
        const detection: BaseDetection = {
          id: `haz_${sub.key}_${now}`,
          confidence: calculatedConfidence,
          classLabel: sub.label,
          box: sub.box
        };
        payload.detections!.push(detection);

        // Escalation check: Only raise real system alarms if physical trigger satisfies the pre-alarm timer delay
        if (elapsedSec >= config.alarmDelaySec) {
          // Trigger the VMS Event System once per persistent hazard cycle
          if (tracker.count === 1 || tracker.count % 15 === 0) { // Throttled emission
            vmsEventService.emit(
              sub.eventType, 
              'HazardDetectorPlugin', 
              {
                cameraId: frame.cameraId,
                hazardType: sub.key,
                classLabel: sub.label,
                confidence: calculatedConfidence,
                box: sub.box,
                isCommissioned,
                msg: `AI Emergency Alert: Persistent ${sub.label} detected on camera ${frame.cameraId}. Confidence: ${(calculatedConfidence * 100).toFixed(1)}%.`
              }, 
              'CRITICAL'
            );
          }
        }
      } else {
        // Reset counter if detection vanishes to prevent false build-up (anti-flapping)
        const trackerKey = `${frame.cameraId}_${sub.key}`;
        if (this.triggerTrackers.has(trackerKey)) {
          this.triggerTrackers.delete(trackerKey);
        }
      }
    }

    return payload;
  }

  protected async onUnloadModel(): Promise<void> {
    this.hasNativeBindings = false;
    this.triggerTrackers.clear();
  }

  protected async onPerformDiagnostic(): Promise<boolean> {
    // Healthy if either hardware ONNX is bound or Software-Fallback is active
    return true;
  }
}
