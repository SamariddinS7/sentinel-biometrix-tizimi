
import { User, UserRole, AuthSession, AuditLogEntry } from '../types';

const STORAGE_KEY_USER = 'sentinel_auth_user';
const STORAGE_KEY_LOGS = 'sentinel_audit_logs';

class AuthService {
  private currentUser: User | null = null;
  private auditLogs: AuditLogEntry[] = [];

  constructor() {
    this.loadUser();
    this.loadLogs();
  }

  private loadUser() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      if (stored) {
        this.currentUser = JSON.parse(stored);
      } else {
        // Default Admin for Demo Initialization
        this.currentUser = {
          id: 'U-ADMIN-01',
          fullName: 'Admin User',
          email: 'admin@sentinel.sys',
          role: UserRole.ADMIN,
          department: 'Security Operations',
          enrolledDate: '2023-01-01',
          hasEmbedding: true,
          lastActive: 'Just now',
          avatarUrl: 'https://ui-avatars.com/api/?name=Admin+User&background=0ea5e9&color=fff&size=128',
          permissions: ['ALL_ACCESS', 'MANAGE_USERS', 'VIEW_LOGS', 'SYSTEM_CONFIG']
        };
      }
    } catch (e) {
      console.error("Failed to load user session", e);
    }
  }

  private loadLogs() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_LOGS);
        if (stored) this.auditLogs = JSON.parse(stored);
      } catch (e) {
        this.auditLogs = [];
      }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Simulate Login
  login(email: string): Promise<User> {
    return new Promise((resolve) => {
      // In a real app, verify credentials here
      this.currentUser = {
        ...this.currentUser!,
        email: email,
        lastActive: 'Just now'
      };
      this.persistUser();
      this.logAction('AUTH', 'User Logged In', 'SUCCESS');
      resolve(this.currentUser);
    });
  }

  // Simulate Logout
  logout() {
    this.logAction('AUTH', 'User Logged Out', 'SUCCESS');
    // We don't nullify currentUser completely to keep demo state, 
    // but in prod we would remove storage key.
    // this.currentUser = null; 
    // localStorage.removeItem(STORAGE_KEY_USER);
  }

  updateProfile(updates: Partial<User>): User {
    if (!this.currentUser) throw new Error("No active session");
    
    const oldName = this.currentUser.fullName;
    this.currentUser = { ...this.currentUser, ...updates };
    this.persistUser();
    
    if (updates.fullName && updates.fullName !== oldName) {
        this.logAction('PROFILE', `Name changed from ${oldName} to ${updates.fullName}`, 'SUCCESS');
    } else {
        this.logAction('PROFILE', 'Profile details updated', 'SUCCESS');
    }
    
    return this.currentUser;
  }

  private persistUser() {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.currentUser));
  }

  // Session Management
  getSessions(): AuthSession[] {
    // Mock sessions for the UI
    return [
      { id: 'sess-01', device: 'Desktop PC (Windows 11)', browser: 'Chrome 120.0', ip: '192.168.1.50', lastActive: 'Now', isCurrent: true, location: 'New York, USA' },
      { id: 'sess-02', device: 'iPad Pro', browser: 'Safari Mobile', ip: '192.168.1.102', lastActive: '2 hours ago', isCurrent: false, location: 'New York, USA' },
      { id: 'sess-03', device: 'Security Station 4', browser: 'Firefox', ip: '10.0.0.45', lastActive: '1 day ago', isCurrent: false, location: 'New York, USA' },
    ];
  }

  revokeSession(sessionId: string) {
    this.logAction('SECURITY', `Revoked session ${sessionId}`, 'WARNING');
    // In real app: Call API to invalidate token
  }

  // Security
  changePassword(oldPass: string, newPass: string): Promise<boolean> {
      return new Promise((resolve) => {
          // Simulate API delay
          setTimeout(() => {
              this.logAction('SECURITY', 'Password changed successfully', 'SUCCESS');
              resolve(true);
          }, 1000);
      });
  }

  // Audit Logging
  logAction(module: string, action: string, status: 'SUCCESS' | 'FAILURE' | 'WARNING' = 'SUCCESS') {
      const entry: AuditLogEntry = {
          id: `AUDIT-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          action,
          module,
          timestamp: new Date().toISOString(),
          details: `Action performed by ${this.currentUser?.email || 'System'}`,
          status,
          user: this.currentUser?.email || 'System'
      };
      this.auditLogs.unshift(entry);
      // Keep last 50 logs locally
      this.auditLogs = this.auditLogs.slice(0, 50);
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(this.auditLogs));
  }

  getAuditLogs(): AuditLogEntry[] {
      return this.auditLogs;
  }
}

export const authService = new AuthService();
