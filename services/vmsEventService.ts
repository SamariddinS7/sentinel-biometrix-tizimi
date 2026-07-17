import { getLocalCache, setLocalCache } from './firestoreService';

export type VmsEventType =
  // ── System ──────────────────────────────────────────────────────────
  | 'CAMERA_CONNECTED'
  | 'CAMERA_DISCONNECTED'
  | 'AI_DETECTION_FINISHED'
  | 'FACE_RECOGNIZED'
  | 'RECORDING_STARTED'
  | 'RECORDING_STOPPED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'SYSTEM_ERROR'
  | 'STORAGE_WARNING'
  // ── Hazard / Safety (camera-capable) ────────────────────────────────
  | 'HAZARD_DETECTED'
  | 'FIRE_DETECTED'
  | 'SMOKE_DETECTED'
  | 'EXPLOSION_DETECTED'
  | 'SPARK_DETECTED'
  | 'FLOOD_DETECTED'
  | 'WATER_LEAK_DETECTED'
  // ── Hazard / Safety (sensor integration ready) ──────────────────────
  | 'GAS_LEAK_DETECTED'
  | 'CHEMICAL_SPILL_DETECTED'
  // ── PPE / Safety compliance ──────────────────────────────────────────
  | 'PPE_VIOLATION'
  | 'HELMET_MISSING'
  | 'MASK_MISSING'
  // ── Vehicle & Traffic ────────────────────────────────────────────────
  | 'VEHICLE_DETECTED'
  | 'VEHICLE_ENTERED'
  | 'VEHICLE_EXITED'
  | 'PLATE_RECOGNIZED'
  // ── OCR ─────────────────────────────────────────────────────────────
  | 'OCR_COMPLETED'
  // ── Crowd & Occupancy ────────────────────────────────────────────────
  | 'CROWD_DETECTED'
  | 'OCCUPANCY_UPDATED'
  | 'QUEUE_DETECTED'
  | 'HEATMAP_UPDATED'
  | 'PEOPLE_COUNT_UPDATED'
  // ── Behaviour & Spatial ──────────────────────────────────────────────
  | 'LOITERING_DETECTED'
  | 'INTRUSION_DETECTED'
  | 'LINE_CROSSED'
  | 'ZONE_ENTERED'
  | 'ZONE_EXITED'
  | 'WRONG_DIRECTION_DETECTED'
  | 'ABANDONED_OBJECT_DETECTED'
  | 'REMOVED_OBJECT_DETECTED'
  | 'BEHAVIOR_ANALYZED'
  // ── Analytics meta ───────────────────────────────────────────────────
  | 'ANALYTICS_COMPLETED'
  | 'ANALYTICS_ALARM_CREATED';

export interface VmsEvent<T = any> {
  id: string;
  type: VmsEventType;
  timestamp: string;
  source: string;
  payload: T;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
}

type VmsEventCallback<T = any> = (event: VmsEvent<T>) => void;

class VmsEventBroker {
  private static instance: VmsEventBroker;
  private listeners: Map<VmsEventType, Set<VmsEventCallback>> = new Map();
  private eventHistory: VmsEvent[] = [];
  private readonly CACHE_KEY = 'vms_event_history';

  private constructor() {
    // Load historical events for analytical display
    this.eventHistory = getLocalCache<VmsEvent>(this.CACHE_KEY, []);
  }

  public static getInstance(): VmsEventBroker {
    if (!VmsEventBroker.instance) {
      VmsEventBroker.instance = new VmsEventBroker();
    }
    return VmsEventBroker.instance;
  }

  private globalListeners: Set<VmsEventCallback> = new Set();

  public subscribeToAll(callback: VmsEventCallback): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  /**
   * Subscribe to a specific VMS Event type
   */
  public subscribe<T = any>(type: VmsEventType, callback: VmsEventCallback<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(type);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Emit a new VMS Event into the system
   */
  public emit<T = any>(type: VmsEventType, source: string, payload: T, severity: VmsEvent['severity'] = 'INFO'): void {
    const event: VmsEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date().toISOString(),
      source,
      payload,
      severity
    };

    // Store in history (cap at 200 items for memory efficiency)
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > 200) {
      this.eventHistory.pop();
    }
    setLocalCache(this.CACHE_KEY, this.eventHistory);

    // Notify listeners
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(event);
        } catch (error) {
          console.error(`Error in VMS Event Listener for ${type}:`, error);
        }
      });
    }

    // Also notify global wildcard listeners if any (can be added if required)
    this.globalListeners.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        console.error(`Error in global VMS Event Listener:`, error);
      }
    });
  }

  /**
   * Fetch historical events
   */
  public getHistory(): VmsEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  public clearHistory(): void {
    this.eventHistory = [];
    setLocalCache(this.CACHE_KEY, []);
  }
}

export const vmsEventService = VmsEventBroker.getInstance();
