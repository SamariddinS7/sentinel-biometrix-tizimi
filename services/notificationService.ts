import { Notification, NotificationSettings } from '../types';

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
    const savedSettings = localStorage.getItem('notification_settings');
    if (savedSettings) {
      this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
    }

    // Mock initial notifications
    this.notifications = [
      {
        id: '1',
        type: 'CRITICAL',
        title: 'System Update Required',
        message: 'Critical security patch available. Please update immediately.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        read: false
      },
      {
        id: '2',
        type: 'WARNING',
        title: 'High Latency Detected',
        message: 'Camera node CAM-03 is experiencing high latency (200ms).',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        read: false
      },
      {
        id: '3',
        type: 'INFO',
        title: 'Shift Started',
        message: 'Morning shift has started. 45 employees checked in.',
        timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        read: true
      }
    ];
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
    localStorage.setItem('notification_settings', JSON.stringify(this.settings));
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
    this.notifyListeners();
  }

  markAsRead(id: string) {
    this.notifications = this.notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    );
    this.notifyListeners();
  }

  markAllAsRead() {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.notifyListeners();
  }

  deleteNotification(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notifyListeners();
  }

  clearAll() {
    this.notifications = [];
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
