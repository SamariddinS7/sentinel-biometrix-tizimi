import { Notification, NotificationSettings } from '../types';
import { vmsEventService, VmsEvent } from './vmsEventService';

class NotificationService {
  private notifications: Notification[] = [];
  private settings: NotificationSettings = {
    enableEmail: false,
    enableWebhook: false,
    webhookUrl: '',
    alertOnUnknown: true,
    alertOnSpoof: true,
    enablePush: true,
    alertOnLate: false,
    alertOnEarlyLeave: false,
    alertOnSystemError: true,
    emailRecipients: ''
  };
  private listeners: ((notifications: Notification[]) => void)[] = [];

  constructor() {
    // Load from localStorage if available
    try {
      if (typeof localStorage !== 'undefined') {
        const savedSettings = localStorage.getItem('notification_settings');
        if (savedSettings && savedSettings !== "undefined" && savedSettings !== "null") {
          this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
      }
    } catch (e) {
      console.warn("Failed to parse notification settings:", e);
    }

    try {
      if (typeof localStorage !== 'undefined') {
        const savedNotifications = localStorage.getItem('sentinel_notifications');
        if (savedNotifications && savedNotifications !== "undefined" && savedNotifications !== "null") {
          let parsed = JSON.parse(savedNotifications);
          // Remove old hardcoded mock notifications
          parsed = parsed.filter((n: any) => n.title !== 'System Update Required' && n.title !== 'High Latency Detected' && n.title !== 'Shift Started');
          this.notifications = parsed;
        } else {
          this.notifications = [];
        }
      } else {
        this.notifications = [];
      }
    } catch (e) {
      console.warn("Failed to parse notifications:", e);
      this.notifications = [];
    }

    // Subscribe to VMS events to generate real notifications
    this.setupEventSubscriptions();
  }

  private setupEventSubscriptions() {
    vmsEventService.subscribe('SYSTEM_ERROR', (event: VmsEvent) => {
      if (!this.settings.alertOnSystemError) return;
      this.addNotification({
        type: 'CRITICAL',
        title: 'System Error',
        message: String(event.payload || 'An unknown system error occurred'),
      });
    });

    vmsEventService.subscribe('CAMERA_DISCONNECTED', (event: VmsEvent) => {
      this.addNotification({
        type: 'WARNING',
        title: 'Camera Disconnected',
        message: `Camera ${event.source} has lost connection.`,
      });
    });

    vmsEventService.subscribe('CAMERA_CONNECTED', (event: VmsEvent) => {
      this.addNotification({
        type: 'INFO',
        title: 'Camera Connected',
        message: `Camera ${event.source} is now online.`,
      });
    });

    vmsEventService.subscribe('FACE_RECOGNIZED', (event: VmsEvent) => {
      // Don't spam notifications for successful access unless specifically requested
      // For now, let's notify for Unknowns and Spoofs instead, which we can hook up later
    });

    const hazards: ('HAZARD_DETECTED' | 'FIRE_DETECTED' | 'SMOKE_DETECTED' | 'GAS_LEAK_DETECTED' | 'EXPLOSION_DETECTED' | 'SPARK_DETECTED' | 'FLOOD_DETECTED' | 'WATER_LEAK_DETECTED' | 'CHEMICAL_SPILL_DETECTED')[] = [
      'HAZARD_DETECTED', 'FIRE_DETECTED', 'SMOKE_DETECTED', 'GAS_LEAK_DETECTED', 'EXPLOSION_DETECTED', 'SPARK_DETECTED', 'FLOOD_DETECTED', 'WATER_LEAK_DETECTED', 'CHEMICAL_SPILL_DETECTED'
    ];
    
    hazards.forEach(hazard => {
      vmsEventService.subscribe(hazard, (event: VmsEvent) => {
        this.addNotification({
          type: 'CRITICAL',
          title: hazard.replace(/_/g, ' '),
          message: `${hazard.replace(/_/g, ' ')} detected at ${event.source}`,
        });
      });
    });
  }

  private persistNotifications() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sentinel_notifications', JSON.stringify(this.notifications));
      }
    } catch (e) {
      console.warn("Failed to save notifications to localStorage:", e);
    }
  }

  getNotifications(): Notification[] {
    return this.notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  getSettings(): NotificationSettings {
    return this.settings;
  }

  updateSettings(newSettings: Partial<NotificationSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('notification_settings', JSON.stringify(this.settings));
      }
    } catch (e) {
      console.warn("Failed to save notification settings:", e);
    }
  }

  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      read: false
    };

    // Check settings before adding
    if (notification.type === 'CRITICAL' && !this.settings.alertOnSystemError) return;
    // Add more checks based on type/settings mapping if needed

    this.notifications = [newNotification, ...this.notifications];
    this.persistNotifications();
    this.notifyListeners();
  }

  markAsRead(id: string) {
    this.notifications = this.notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    );
    this.persistNotifications();
    this.notifyListeners();
  }

  markAllAsRead() {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.persistNotifications();
    this.notifyListeners();
  }

  deleteNotification(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.persistNotifications();
    this.notifyListeners();
  }

  clearAll() {
    this.notifications = [];
    this.persistNotifications();
    this.notifyListeners();
  }

  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.getNotifications()));
  }
}

export const notificationService = new NotificationService();
