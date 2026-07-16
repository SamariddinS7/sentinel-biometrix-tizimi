/**
 * Sentinel VMS — Snapshot Manager
 *
 * Handles manual, scheduled, and event-triggered snapshots.
 * Each snapshot carries full metadata (timestamp, camera info, trigger).
 * Snapshots are stored on disk at /var/lib/vms/snapshots/ and indexed in Firestore.
 */

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { db } from '../firestoreService';
import { doc, setDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { vmsEventService } from '../vmsEventService';

export interface SnapshotMetadata {
  id: string;
  cameraId: string;
  cameraName: string;
  trigger: 'MANUAL' | 'SCHEDULED' | 'EVENT';
  triggerDetail?: string;
  timestamp: string;
  filePath: string;
  fileSizeBytes: number;
  resolution: string;
  thumbnailBase64?: string; // Optional inline preview (first 64KB max)
}

export interface SnapshotSchedule {
  cameraId: string;
  intervalMs: number;
  timer: NodeJS.Timeout;
}

type SnapshotProvider = (cameraId: string, profile?: string) => Promise<Buffer>;

const SNAPSHOT_ROOT = '/var/lib/vms/snapshots';

class SnapshotManager extends EventEmitter {
  private static instance: SnapshotManager;
  private providers: Map<string, SnapshotProvider> = new Map();
  private schedules: Map<string, SnapshotSchedule> = new Map();
  private cameraNames: Map<string, string> = new Map();

  private constructor() {
    super();
    this.ensureStorageDir();
  }

  public static getInstance(): SnapshotManager {
    if (!SnapshotManager.instance) {
      SnapshotManager.instance = new SnapshotManager();
    }
    return SnapshotManager.instance;
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(SNAPSHOT_ROOT, { recursive: true });
    } catch {
      // Directory may already exist or filesystem is read-only (cloud env)
    }
  }

  // ─── Registration ──────────────────────────────────────────────────────────

  public register(cameraId: string, cameraName: string, provider: SnapshotProvider): void {
    this.providers.set(cameraId, provider);
    this.cameraNames.set(cameraId, cameraName);
  }

  public unregister(cameraId: string): void {
    this.providers.delete(cameraId);
    this.cameraNames.delete(cameraId);
    this.cancelSchedule(cameraId);
  }

  // ─── Manual Snapshot ───────────────────────────────────────────────────────

  public async takeManualSnapshot(cameraId: string): Promise<SnapshotMetadata> {
    return this.capture(cameraId, 'MANUAL');
  }

  // ─── Scheduled Snapshot ────────────────────────────────────────────────────

  public scheduleSnapshots(cameraId: string, intervalMs: number): void {
    this.cancelSchedule(cameraId); // Idempotent
    const timer = setInterval(async () => {
      try {
        await this.capture(cameraId, 'SCHEDULED');
      } catch {
        // Non-fatal — schedule continues
      }
    }, intervalMs);
    this.schedules.set(cameraId, { cameraId, intervalMs, timer });
  }

  public cancelSchedule(cameraId: string): void {
    const schedule = this.schedules.get(cameraId);
    if (schedule) {
      clearInterval(schedule.timer);
      this.schedules.delete(cameraId);
    }
  }

  // ─── Event Snapshot ────────────────────────────────────────────────────────

  public async takeEventSnapshot(cameraId: string, eventDetail: string): Promise<SnapshotMetadata> {
    return this.capture(cameraId, 'EVENT', eventDetail);
  }

  // ─── Query ─────────────────────────────────────────────────────────────────

  public async listSnapshots(cameraId: string, maxCount = 50): Promise<SnapshotMetadata[]> {
    try {
      const q = query(
        collection(db, 'snapshots'),
        where('cameraId', '==', cameraId),
        orderBy('timestamp', 'desc'),
        limit(maxCount),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as SnapshotMetadata);
    } catch {
      return [];
    }
  }

  // ─── Core capture logic ────────────────────────────────────────────────────

  private async capture(
    cameraId: string,
    trigger: SnapshotMetadata['trigger'],
    triggerDetail?: string,
  ): Promise<SnapshotMetadata> {
    const provider = this.providers.get(cameraId);
    if (!provider) {
      throw new Error(`No snapshot provider registered for camera ${cameraId}`);
    }

    const timestamp = new Date().toISOString();
    const id = `snap_${cameraId}_${Date.now()}`;
    const fileName = `${id}.jpg`;
    const filePath = path.join(SNAPSHOT_ROOT, cameraId, fileName);

    // Get raw JPEG bytes from the driver
    const jpegData = await provider(cameraId);
    if (!jpegData || jpegData.length === 0) {
      throw new Error(`Snapshot provider returned empty frame for camera ${cameraId}`);
    }

    // Persist to disk
    try {
      await fs.mkdir(path.join(SNAPSHOT_ROOT, cameraId), { recursive: true });
      await fs.writeFile(filePath, jpegData);
    } catch {
      // Filesystem write failed (cloud env) — continue without disk storage
    }

    const meta: SnapshotMetadata = {
      id,
      cameraId,
      cameraName: this.cameraNames.get(cameraId) ?? cameraId,
      trigger,
      triggerDetail,
      timestamp,
      filePath,
      fileSizeBytes: jpegData.length,
      resolution: this.detectResolution(jpegData),
      thumbnailBase64: jpegData.length <= 64 * 1024
        ? jpegData.toString('base64')
        : jpegData.slice(0, 64 * 1024).toString('base64'),
    };

    // Persist metadata to Firestore
    try {
      await setDoc(doc(db, 'snapshots', id), {
        ...meta,
        thumbnailBase64: undefined, // Don't store large base64 in Firestore
      });
    } catch {
      // Non-fatal
    }

    // Emit event
    vmsEventService.emit('CAMERA_CONNECTED', 'SnapshotManager', {
      cameraId,
      snapshotId: id,
      trigger,
      fileSizeBytes: jpegData.length,
    }, 'INFO');

    this.emit('snapshot', meta);
    return meta;
  }

  private detectResolution(jpegData: Buffer): string {
    // JPEG SOF marker detection (minimal parser)
    try {
      for (let i = 0; i < jpegData.length - 8; i++) {
        if (jpegData[i] === 0xFF && (jpegData[i + 1] & 0xF0) === 0xC0 &&
            jpegData[i + 1] !== 0xFF) {
          if ([0xC0, 0xC1, 0xC2].includes(jpegData[i + 1])) {
            const height = jpegData.readUInt16BE(i + 5);
            const width = jpegData.readUInt16BE(i + 7);
            if (width > 0 && height > 0) return `${width}x${height}`;
          }
        }
      }
    } catch {
      // Parsing failed
    }
    return 'Unknown';
  }
}

export const snapshotManager = SnapshotManager.getInstance();
