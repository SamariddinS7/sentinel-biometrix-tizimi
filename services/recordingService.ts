import { vmsEventService, VmsEvent } from './vmsEventService';
import { vmsStorageService, EvidenceClip } from './vmsStorageService';
import { db } from './firestoreService';
import { collection, setDoc, doc } from 'firebase/firestore';

export interface RecordingSession {
  cameraId: string;
  cameraName: string;
  triggerEvent: string;
  startTime: string;
  preEventBufferSec: number;
  postEventBufferSec: number;
  status: 'RECORDING' | 'COMPLETED' | 'FAILED';
  resolution: string;
  fps: number;
  bitrateMbps: number;
}

class RecordingService {
  private static instance: RecordingService;
  private activeSessions: Map<string, RecordingSession> = new Map(); // Key: cameraId
  private ringBuffers: Map<string, Array<{ timestamp: number; frameId: string }>> = new Map(); // Circular pre-event buffer

  private constructor() {
    this.initializeEventSubscriptions();
  }

  public static getInstance(): RecordingService {
    if (!RecordingService.instance) {
      RecordingService.instance = new RecordingService();
    }
    return RecordingService.instance;
  }

  /**
   * Automatically listen to real VMS events and fire pre/post event recording cycles
   */
  private initializeEventSubscriptions() {
    const hazardEvents: Array<any> = [
      'FIRE_DETECTED',
      'SMOKE_DETECTED',
      'GAS_LEAK_DETECTED',
      'EXPLOSION_DETECTED',
      'SPARK_DETECTED',
      'FLOOD_DETECTED',
      'WATER_LEAK_DETECTED',
      'CHEMICAL_SPILL_DETECTED',
      'HAZARD_DETECTED'
    ];

    hazardEvents.forEach(type => {
      vmsEventService.subscribe(type, (event: VmsEvent) => {
        this.handleHazardEvent(event);
      });
    });
  }

  /**
   * Feeds frames into circular ring buffers to maintain pre-event history in memory
   */
  public pushToRingBuffer(cameraId: string, frameId: string) {
    if (!this.ringBuffers.has(cameraId)) {
      this.ringBuffers.set(cameraId, []);
    }
    const buffer = this.ringBuffers.get(cameraId)!;
    buffer.push({ timestamp: Date.now(), frameId });
    
    // Maintain maximum 10-second buffer (at 25 fps, max 250 frames)
    if (buffer.length > 250) {
      buffer.shift();
    }
  }

  /**
   * Processes incoming hazard events and triggers recording sessions
   */
  private async handleHazardEvent(event: VmsEvent) {
    const { cameraId, hazardType, classLabel, confidence, isCommissioned } = event.payload;
    
    // Check if camera is already recording
    if (this.activeSessions.has(cameraId)) {
      // Alarm persistence: Extend active recording duration
      return;
    }

    console.log(`[RecordingService] Hazard Event received. Initializing post-event recording. Camera: ${cameraId}, Hazard: ${hazardType}`);

    const cameraName = cameraId === 'CAM-01' ? 'Office Entrance Main' : 
                       cameraId === 'CAM-02' ? 'Gate Entry Camera' : 
                       cameraId === 'CAM-03' ? 'Server Room Thermal' : 'Zone Sector 4';

    const session: RecordingSession = {
      cameraId,
      cameraName,
      triggerEvent: `${event.type} (${classLabel})`,
      startTime: new Date().toISOString(),
      preEventBufferSec: 5,
      postEventBufferSec: 10,
      status: 'RECORDING',
      resolution: '1920x1080',
      fps: 25,
      bitrateMbps: 4.2
    };

    this.activeSessions.set(cameraId, session);

    // Emit event that recording started
    vmsEventService.emit('RECORDING_STARTED', 'RecordingService', {
      cameraId,
      cameraName,
      triggerEvent: session.triggerEvent,
      startTime: session.startTime
    }, 'INFO');

    // Simulate real video chunk writing sequence for post-event duration (10 seconds)
    setTimeout(() => {
      this.finalizeRecording(cameraId);
    }, session.postEventBufferSec * 1000);
  }

  /**
   * Finalizes the video chunk, calculates total file size, creates evidence files, and saves to database
   */
  private async finalizeRecording(cameraId: string) {
    const session = this.activeSessions.get(cameraId);
    if (!session) return;

    this.activeSessions.delete(cameraId);
    session.status = 'COMPLETED';

    const duration = session.preEventBufferSec + session.postEventBufferSec;
    // Calculate size in bytes based on bitrate and duration: Size = Bitrate * Duration / 8
    const fileSizeBytes = Math.round((session.bitrateMbps * 1024 * 1024 * duration) / 8);
    const filePath = `/var/lib/vms/storage/main/clip_${Date.now()}_${cameraId}.mp4`;

    const clip: Omit<EvidenceClip, 'id'> = {
      cameraId: session.cameraId,
      cameraName: session.cameraName,
      timestamp: session.startTime,
      durationSec: duration,
      fileSizeBytes,
      filePath,
      triggerEvent: session.triggerEvent,
      isLocked: true // Real safety practice: Lock all automated hazard evidence clips by default to prevent FIFO deletion
    };

    // Save clip inside the storage evidence locker (safely triggers disk allocation and rotation checks)
    const savedClip = vmsStorageService.saveEvidence(clip);

    // Write metadata record to Firestore database
    try {
      const recDoc = doc(collection(db, 'recordings'), `REC-${savedClip.id}`);
      await setDoc(recDoc, {
        id: `REC-${savedClip.id}`,
        cameraId: savedClip.cameraId,
        cameraName: savedClip.cameraName,
        startTime: savedClip.timestamp,
        endTime: new Date(new Date(savedClip.timestamp).getTime() + savedClip.durationSec * 1000).toISOString(),
        fileSizeMb: parseFloat((savedClip.fileSizeBytes / (1024 * 1024)).toFixed(1)),
        recordingType: 'Emergency',
        filePath: savedClip.filePath,
        triggerEvent: savedClip.triggerEvent,
        evidenceId: savedClip.id
      });
    } catch (e) {
      console.warn('[RecordingService] Failed to write recording metadata to Firestore. Saved locally.', e);
    }

    // Emit event that recording stopped and evidence is ready
    vmsEventService.emit('RECORDING_STOPPED', 'RecordingService', {
      cameraId,
      clipId: savedClip.id,
      filePath: savedClip.filePath,
      duration,
      sizeMb: (savedClip.fileSizeBytes / (1024 * 1024)).toFixed(1),
      msg: `AI Incident recording captured: ${session.triggerEvent}. Duration: ${duration}s. Evidence locked successfully.`
    }, 'SUCCESS');
  }

  public getActiveSessions(): RecordingSession[] {
    return Array.from(this.activeSessions.values());
  }
}

export const recordingService = RecordingService.getInstance();
