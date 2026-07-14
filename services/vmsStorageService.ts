import { getLocalCache, setLocalCache } from './firestoreService';
import { vmsEventService } from './vmsEventService';

export interface StorageVolume {
  mountPoint: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercentage: number;
  type: 'SSD' | 'HDD' | 'CLOUD';
}

export interface EvidenceClip {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  durationSec: number;
  fileSizeBytes: number;
  filePath: string;
  triggerEvent: string;
  isLocked: boolean; // Locked files bypass FIFO rotation rules
}

class VmsStorageService {
  private static instance: VmsStorageService;
  private readonly CACHE_KEY_VOLUMES = 'vms_storage_volumes';
  private readonly CACHE_KEY_EVIDENCE = 'vms_evidence_locker';

  private volumes: StorageVolume[] = [];
  private evidenceLocker: EvidenceClip[] = [];

  private constructor() {
    this.volumes = getLocalCache<StorageVolume>(this.CACHE_KEY_VOLUMES, [
      {
        mountPoint: '/var/lib/vms/storage/main',
        totalBytes: 2 * 1024 * 1024 * 1024 * 1024, // 2 TB
        usedBytes: 1.45 * 1024 * 1024 * 1024 * 1024, // 1.45 TB
        freeBytes: 0.55 * 1024 * 1024 * 1024 * 1024,
        usagePercentage: 72.5,
        type: 'SSD'
      },
      {
        mountPoint: '/mnt/vms/archive/backup',
        totalBytes: 10 * 1024 * 1024 * 1024 * 1024, // 10 TB
        usedBytes: 8.2 * 1024 * 1024 * 1024 * 1024, // 8.2 TB
        freeBytes: 1.8 * 1024 * 1024 * 1024 * 1024,
        usagePercentage: 82,
        type: 'HDD'
      }
    ]);

    this.evidenceLocker = getLocalCache<EvidenceClip>(this.CACHE_KEY_EVIDENCE, [
      {
        id: 'ev_001',
        cameraId: 'cam_office_01',
        cameraName: 'Office Entrance Main',
        timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
        durationSec: 45,
        fileSizeBytes: 14 * 1024 * 1024, // 14 MB
        filePath: '/var/lib/vms/storage/main/ev_001.mp4',
        triggerEvent: 'FACE_RECOGNIZED_UNAUTHORIZED',
        isLocked: true
      },
      {
        id: 'ev_002',
        cameraId: 'cam_parking_02',
        cameraName: 'Gate Entry Camera',
        timestamp: new Date(Date.now() - 12 * 3600000).toISOString(),
        durationSec: 120,
        fileSizeBytes: 42 * 1024 * 1024, // 42 MB
        filePath: '/var/lib/vms/storage/main/ev_002.mp4',
        triggerEvent: 'ZONE_INTRUSION_ALERT',
        isLocked: false
      }
    ]);
  }

  public static getInstance(): VmsStorageService {
    if (!VmsStorageService.instance) {
      VmsStorageService.instance = new VmsStorageService();
    }
    return VmsStorageService.instance;
  }

  /**
   * Get telemetry of active enterprise storage volumes
   */
  public getVolumes(): StorageVolume[] {
    return [...this.volumes];
  }

  /**
   * Allocate space on partition, checking constraints
   */
  public allocateSpace(volumePath: string, bytesToAllocate: number): boolean {
    const volumeIndex = this.volumes.findIndex(v => v.mountPoint === volumePath);
    if (volumeIndex === -1) return false;

    const volume = this.volumes[volumeIndex];
    if (volume.freeBytes < bytesToAllocate) {
      vmsEventService.emit('STORAGE_WARNING', 'StorageManager', {
        volume: volumePath,
        msg: 'Allocation failed: Insufficient space. Initiating automated rotation.'
      }, 'CRITICAL');
      this.runFifoRotation(volumePath);
      return false;
    }

    volume.usedBytes += bytesToAllocate;
    volume.freeBytes = volume.totalBytes - volume.usedBytes;
    volume.usagePercentage = parseFloat(((volume.usedBytes / volume.totalBytes) * 100).toFixed(1));

    this.volumes[volumeIndex] = volume;
    setLocalCache(this.CACHE_KEY_VOLUMES, this.volumes);

    if (volume.usagePercentage > 90) {
      vmsEventService.emit('STORAGE_WARNING', 'StorageManager', {
        volume: volumePath,
        usage: volume.usagePercentage
      }, 'WARNING');
    }

    return true;
  }

  /**
   * Run FIFO automated rotation to purge old unlocked files
   */
  public runFifoRotation(volumePath: string): void {
    // Collect non-locked clips, sort oldest first, and delete
    const unlockedClips = this.evidenceLocker
      .filter(clip => !clip.isLocked && clip.filePath.startsWith(volumePath))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (unlockedClips.length === 0) {
      console.warn(`VMS Storage: No purgeable assets left in volume ${volumePath}!`);
      return;
    }

    // Purge the oldest clip
    const targetToPurge = unlockedClips[0];
    this.evidenceLocker = this.evidenceLocker.filter(clip => clip.id !== targetToPurge.id);
    setLocalCache(this.CACHE_KEY_EVIDENCE, this.evidenceLocker);

    // Reclaim storage bytes
    const volumeIndex = this.volumes.findIndex(v => v.mountPoint === volumePath);
    if (volumeIndex !== -1) {
      const volume = this.volumes[volumeIndex];
      volume.usedBytes = Math.max(0, volume.usedBytes - targetToPurge.fileSizeBytes);
      volume.freeBytes = volume.totalBytes - volume.usedBytes;
      volume.usagePercentage = parseFloat(((volume.usedBytes / volume.totalBytes) * 100).toFixed(1));
      this.volumes[volumeIndex] = volume;
      setLocalCache(this.CACHE_KEY_VOLUMES, this.volumes);
    }

    vmsEventService.emit('RECORDING_STOPPED', 'StorageManager', {
      msg: `FIFO Rotation triggered: Purged archive clip ${targetToPurge.id} (${(targetToPurge.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB)`
    }, 'INFO');
  }

  /**
   * Fetch all clips in Evidence Locker
   */
  public getEvidenceLocker(): EvidenceClip[] {
    return [...this.evidenceLocker];
  }

  /**
   * Add a new clip to the Evidence Locker
   */
  public saveEvidence(clip: Omit<EvidenceClip, 'id'>): EvidenceClip {
    const newClip: EvidenceClip = {
      ...clip,
      id: `ev_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    };

    // Attempt space allocation in main storage volume
    const volumePath = '/var/lib/vms/storage/main';
    this.allocateSpace(volumePath, newClip.fileSizeBytes);

    this.evidenceLocker.unshift(newClip);
    setLocalCache(this.CACHE_KEY_EVIDENCE, this.evidenceLocker);

    return newClip;
  }

  /**
   * Toggle integrity lock on critical evidence file
   */
  public toggleEvidenceLock(id: string): void {
    this.evidenceLocker = this.evidenceLocker.map(clip => {
      if (clip.id === id) {
        return { ...clip, isLocked: !clip.isLocked };
      }
      return clip;
    });
    setLocalCache(this.CACHE_KEY_EVIDENCE, this.evidenceLocker);
  }
}

export const vmsStorageService = VmsStorageService.getInstance();
