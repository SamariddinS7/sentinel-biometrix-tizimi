
import { SystemSettings } from '../types';

const API_BASE = '/api/v1/config'; // In real app, this connects to Python backend

const DEFAULT_SETTINGS: SystemSettings = {
  general: {
    systemName: 'Sentinel Biometrics',
    organizationName: 'Acme Corp',
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    language: 'en-US',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    workStart: '09:00',
    workEnd: '17:00'
  },
  faceRec: {
    modelType: 'ArcFace',
    detectionThreshold: 0.60,
    similarityThreshold: 0.50,
    minFaceQuality: 0.65,
    multiFaceMode: 'First',
    maskDetection: 'Allowed',
    alignFaces: true
  },
  liveness: { 
    enabled: true, 
    checkEyeBlink: false, 
    checkHeadMove: false, 
    confidenceThreshold: 0.9, 
    maxAttempts: 3, 
    lockoutDuration: 15 
  },
  camera: { 
    defaultCameraId: '1', 
    resolution: '1280x720', 
    fpsLimit: 20, 
    autoExposure: true, 
    healthCheckInterval: 5 
  },
  rules: { 
    mode: 'CheckIn_CheckOut', 
    gracePeriod: 15, 
    lateThreshold: 30, 
    earlyLeaveThreshold: 15, 
    autoCheckout: '23:59', 
    preventDuplicateInterval: 5 
  },
  security: { 
    adminPasswordExpiry: 30, 
    minPasswordLength: 14, 
    dataRetentionDays: 90, 
    gdprCompliance: true, 
    anonymizeData: true, 
    requireAdminApprovalForEnrollment: true 
  },
  performance: { 
    recognitionInterval: 100, 
    maxThreads: 4, 
    gpuEnabled: true, 
    batchSize: 1 
  },
  logging: { 
    logLevel: 'INFO', 
    retentionDays: 30, 
    auditTrailEnabled: true 
  },
  notifications: { 
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
  },
  backup: { 
    autoBackup: true, 
    backupInterval: 'Weekly', 
    encryptBackups: true, 
    lastBackupDate: '' 
  }
};

export const settingsService = {
  // Simulate Async Fetch from Backend
  getSettings: async (): Promise<SystemSettings> => {
    try {
        // In production: const res = await fetch(API_BASE); return await res.json();
        const stored = localStorage.getItem('sentinel_config');
        if (stored && stored !== "undefined") return JSON.parse(stored);
        return DEFAULT_SETTINGS;
    } catch (e) {
        console.error("Config fetch failed", e);
        return DEFAULT_SETTINGS;
    }
  },

  // Simulate Async Save to Backend
  saveSettings: async (settings: SystemSettings): Promise<boolean> => {
    try {
        // In production: await fetch(API_BASE, { method: 'POST', body: JSON.stringify(settings) });
        
        // Map Frontend Settings to Backend Dynamic Config Structure
        // This ensures the Python backend receives the exact Pydantic structure
        const backendPayload = {
            general: {
                system_name: settings.general.systemName,
                organization_name: settings.general.organizationName,
                timezone: settings.general.timezone,
                language: settings.general.language,
                working_days: settings.general.workingDays,
                work_start: settings.general.workStart,
                work_end: settings.general.workEnd
            },
            detection: {
                confidence_threshold: settings.faceRec.detectionThreshold,
                nms_threshold: 0.4, // Configurable but hidden in simplified UI
                input_size: 640,
                max_faces: 10,
                min_face_size: 64
            },
            recognition: {
                model_type: settings.faceRec.modelType,
                known_threshold: settings.faceRec.similarityThreshold,
                unknown_threshold: settings.faceRec.similarityThreshold - 0.1, // Derived
                min_quality_score: settings.faceRec.minFaceQuality,
                reidentification_interval: 30,
                align_faces: settings.faceRec.alignFaces
            },
            liveness: {
                enabled: settings.liveness.enabled,
                check_eye_blink: settings.liveness.checkEyeBlink,
                check_head_move: settings.liveness.checkHeadMove,
                confidence_threshold: settings.liveness.confidenceThreshold,
                max_attempts: settings.liveness.maxAttempts,
                lockout_duration_minutes: settings.liveness.lockoutDuration
            },
            attendance: {
                enabled: true,
                mode: settings.rules.mode,
                grace_period_minutes: settings.rules.gracePeriod,
                late_threshold_minutes: settings.rules.lateThreshold,
                auto_checkout_time: settings.rules.autoCheckout,
                prevent_duplicate_interval_minutes: settings.rules.preventDuplicateInterval
            },
            security: {
                encryption_required: true,
                encryption_algorithm: "AES-256-CBC",
                data_retention_days: settings.security.dataRetentionDays,
                allow_forget_person: settings.security.gdprCompliance,
                audit_enabled: settings.logging.auditTrailEnabled,
                log_raw_metadata: false,
                admin_password_expiry_days: settings.security.adminPasswordExpiry,
                require_admin_approval: settings.security.requireAdminApprovalForEnrollment
            },
            performance: {
                frame_queue_size: 5,
                ai_worker_fps: settings.camera.fpsLimit,
                frame_skip: 0,
                batch_size: settings.performance.batchSize,
                gpu_enabled: settings.performance.gpuEnabled
            }
            // ... Mappings for other sections would go here in a real app
        };
        
        console.log("Pushing config to backend:", backendPayload);
        
        localStorage.setItem('sentinel_config', JSON.stringify(settings));
        return true;
    } catch (e) {
        console.error("Config save failed", e);
        return false;
    }
  },

  resetDefaults: async (): Promise<SystemSettings> => {
    localStorage.removeItem('sentinel_config');
    return DEFAULT_SETTINGS;
  },

  exportSettings: () => {
     const settings = localStorage.getItem('sentinel_config');
     if(!settings) return;
     const blob = new Blob([settings], {type: "application/json"});
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = `sentinel_config_${new Date().toISOString()}.json`;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  }
};
