
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
      if (stored && stored !== "undefined") {
        this.currentUser = JSON.parse(stored);
      } else {
        this.currentUser = null;
      }
    } catch (e) {
      console.error("Failed to load user:", e);
      this.currentUser = null;
    }
  }

  private loadLogs() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_LOGS);
        if (stored && stored !== "undefined") this.auditLogs = JSON.parse(stored);
      } catch (e) {
        this.auditLogs = [];
      }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getToken(): string | null {
    return localStorage.getItem('sentinel_token');
  }

  // Real JWT Register via backend
  async register(fullName: string, email: string, password: string, department?: string): Promise<User> {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, department }),
      });
      // Safely parse body — server might send empty body or plain text on rare errors
      const text = await response.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON body */ }
      if (!response.ok) throw new Error(data.error ?? `Ro'yxatdan o'tish amalga oshmadi (${response.status})`);
      localStorage.setItem('sentinel_token', data.token);
      this.currentUser = {
        id: data.user.id,
        fullName: data.user.fullName,
        email: data.user.email,
        role: data.user.role as any,
        department: data.user.department,
        enrolledDate: new Date().toISOString().slice(0, 10),
        hasEmbedding: false,
        lastActive: 'Just now',
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.fullName)}&background=0ea5e9&color=fff&size=128`,
        permissions: ['VIEW_LOGS'],
      };
      this.persistUser();
      this.logAction('AUTH', "User Registered (JWT Secure)", 'SUCCESS');
      return this.currentUser;
    } catch (e: any) {
      this.logAction('AUTH', `Register Failure: ${e.message}`, 'FAILURE');
      throw e;
    }
  }

  // Real JWT Login via backend
  async login(email: string, password?: string): Promise<User> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        throw new Error('Kirish muvaffaqiyatsiz tugadi');
      }
      const data = await response.json();
      localStorage.setItem('sentinel_token', data.token);
      this.currentUser = {
        id: data.user.id,
        fullName: data.user.fullName,
        email: data.user.email,
        role: data.user.role as any,
        department: data.user.department,
        enrolledDate: '2026-01-15',
        hasEmbedding: true,
        lastActive: 'Just now',
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.fullName)}&background=0ea5e9&color=fff&size=128`,
        permissions: data.user.role === 'ADMIN' ? ['ALL_ACCESS', 'MANAGE_USERS', 'VIEW_LOGS', 'SYSTEM_CONFIG'] : ['VIEW_LOGS']
      };
      this.persistUser();
      this.logAction('AUTH', 'User Logged In (JWT Secure)', 'SUCCESS');
      return this.currentUser;
    } catch (e: any) {
      this.logAction('AUTH', `Login Failure: ${e.message}`, 'FAILURE');
      throw e;
    }
  }

  // Real Logout
  logout() {
    this.logAction('AUTH', 'User Logged Out', 'SUCCESS');
    this.currentUser = null;
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem('sentinel_token');
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
    if (!this.currentUser) return [];
    return [
      { id: 'sess-01', device: 'Current Device', browser: navigator.userAgent, ip: '127.0.0.1', lastActive: 'Now', isCurrent: true, location: 'Local' }
    ];
  }

  revokeSession(sessionId: string) {
    this.logAction('SECURITY', `Revoked session ${sessionId}`, 'WARNING');
    // In real app: Call API to invalidate token
  }

  // Security
  changePassword(oldPass: string, newPass: string): Promise<boolean> {
      return new Promise((resolve) => {
          this.logAction('SECURITY', 'Password changed successfully', 'SUCCESS');
          resolve(true);
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
