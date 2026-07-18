import * as crypto from 'crypto';
import { vmsEventService } from '../vmsEventService';
import { BoundingBox, Point } from './DetectionTrackingEngine';

// --- Biometric Event Types ---
export enum BiometricEventType {
  FACE_DETECTED = 'biometric.event.face_detected',
  FACE_RECOGNIZED = 'biometric.event.face_recognized',
  UNKNOWN_PERSON = 'biometric.event.unknown_person',
  WATCHLIST_MATCH = 'biometric.event.watchlist_match',
  BLACKLIST_MATCH = 'biometric.event.blacklist_match',
  WHITELIST_MATCH = 'biometric.event.whitelist_match',
  FACE_LOST = 'biometric.event.face_lost',
  RECOGNITION_FAILED = 'biometric.event.recognition_failed'
}

// --- Face Biometric Data Models ---
export interface FacialLandmarks {
  leftEye: Point;
  rightEye: Point;
  nose: Point;
  mouthLeft: Point;
  mouthRight: Point;
}

export interface FaceQualityMetrics {
  sharpnessScore: number;     // 0.0 to 1.0 (Laplacian variance-based score)
  illuminationUniformity: number; // 0.0 to 1.0 (balanced brightness distribution)
  yawAngleDegrees: number;    // -90.0 to +90.0 (horizontal rotation)
  pitchAngleDegrees: number;  // -90.0 to +90.0 (vertical head tilt)
  rollAngleDegrees: number;   // -90.0 to +90.0 (lateral head tilt)
  isUsable: boolean;          // Evaluated against configured system quality thresholds
}

export interface DetectedFace {
  detectionId: string;
  boundingBox: BoundingBox;
  confidence: number;         // Detector probability score
  landmarks: FacialLandmarks;
  quality: FaceQualityMetrics;
}

export interface BiometricIdentity {
  subjectId: string;          // Cryptographically anonymous UUID matching enrolled DB
  watchlistType: 'WHITELIST' | 'BLACKLIST' | 'WATCHLIST_CUSTOM';
  fullName: string;
  metadata: Record<string, any>;
  version: number;            // Schema versioning for model upgrades
  createdAt: string;
}

export interface FaceMatch {
  identity: BiometricIdentity;
  similarityScore: number;    // Cosine similarity index [0.0 to 1.0]
}

export interface FacePipelineConfig {
  detectionThreshold: number;
  minFaceSizePixels: number;
  maxYawAngle: number;        // e.g. 30 degrees limit for frontal check
  maxPitchAngle: number;      // e.g. 20 degrees limit
  minSharpness: number;       // e.g. 0.60 Laplacian threshold
  embeddingDistanceMetric: 'COSINE' | 'L2';
}

// --- Core Pipeline Interface ---
export interface IFacePipeline {
  detectFaces(frame: Uint8Array, width: number, height: number): Promise<DetectedFace[]>;
  alignAndCrop(frame: Uint8Array, width: number, height: number, face: DetectedFace): Promise<Uint8Array>;
  evaluateQuality(alignedFace: Uint8Array): Promise<FaceQualityMetrics>;
  extractEmbedding(alignedFace: Uint8Array): Promise<Float32Array>; // Output size: 512 floats
}

// --- Face Database Interface ---
export interface EnrolledVectorRecord {
  vectorId: string;
  subjectId: string;
  embedding: Float32Array; // 512 Dimensions
  modelSignature: string;  // e.g. "ArcFace_ResNet50_v2"
  encryptedSourceCrop: string; // Base64 AES-256 encrypted reference thumbnail
}

// --- Secure Encrypted Storage Helpers (AES-256-GCM Envelope Encryption) ---
export class BiometricCryptEngine {
  private static _masterKey: Buffer | null = null;
  private static get masterKey(): Buffer {
    if (!BiometricCryptEngine._masterKey) {
      const seed = process.env.BIOMETRIC_SECRET_SEED;
      if (!seed) {
        throw new Error('[SECURITY] BIOMETRIC_SECRET_SEED env var is not set. Biometric encryption is unavailable. Set this variable before using biometric storage.');
      }
      BiometricCryptEngine._masterKey = crypto.scryptSync(seed, 'sentinel_biometric_kdf_v1', 32);
    }
    return BiometricCryptEngine._masterKey;
  }

  public static encrypt(plainText: string): { iv: string; tag: string; cipherText: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    
    let cipherText = cipher.update(plainText, 'utf8', 'hex');
    cipherText += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    return {
      iv: iv.toString('hex'),
      tag: tag,
      cipherText: cipherText
    };
  }

  public static decrypt(cipherText: string, ivHex: string, tagHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(cipherText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// --- Face Database Implementation (In-Memory with AES-256 Secure Partitioning) ---
export class SecureFaceDatabase {
  private static instance: SecureFaceDatabase;
  private subjectsTable: Map<string, {
    subjectId: string;
    watchlistType: 'WHITELIST' | 'BLACKLIST' | 'WATCHLIST_CUSTOM';
    encryptedName: string;
    encryptedMeta: string;
    ivHex: string;
    tagHex: string;
    createdAt: string;
    version: number;
  }> = new Map();

  private embeddingsTable: EnrolledVectorRecord[] = [];

  private constructor() {}

  public static getInstance(): SecureFaceDatabase {
    if (!SecureFaceDatabase.instance) {
      SecureFaceDatabase.instance = new SecureFaceDatabase();
    }
    return SecureFaceDatabase.instance;
  }

  public enrollSubject(
    watchlistType: 'WHITELIST' | 'BLACKLIST' | 'WATCHLIST_CUSTOM',
    fullName: string,
    metadata: Record<string, any>,
    embedding: Float32Array,
    rawThumbnailB64: string
  ): BiometricIdentity {
    const subjectId = crypto.randomUUID();
    const nameEnc = BiometricCryptEngine.encrypt(fullName);
    const metaEnc = BiometricCryptEngine.encrypt(JSON.stringify(metadata));
    const cropEnc = BiometricCryptEngine.encrypt(rawThumbnailB64);

    this.subjectsTable.set(subjectId, {
      subjectId,
      watchlistType,
      encryptedName: nameEnc.cipherText,
      encryptedMeta: metaEnc.cipherText,
      ivHex: nameEnc.iv,
      tagHex: nameEnc.tag,
      createdAt: new Date().toISOString(),
      version: 1
    });

    const vectorId = crypto.randomUUID();
    this.embeddingsTable.push({
      vectorId,
      subjectId,
      embedding,
      modelSignature: 'ArcFace_ResNet50_v2',
      encryptedSourceCrop: cropEnc.cipherText
    });

    console.log(`[Biometric DB] Enrolled subject ID ${subjectId} in watchlist ${watchlistType}. Name encrypted successfully.`);
    return {
      subjectId,
      watchlistType,
      fullName,
      metadata,
      version: 1,
      createdAt: new Date().toISOString()
    };
  }

  public deleteSubject(subjectId: string): boolean {
    if (!this.subjectsTable.has(subjectId)) return false;
    this.subjectsTable.delete(subjectId);
    this.embeddingsTable = this.embeddingsTable.filter(rec => rec.subjectId !== subjectId);
    console.log(`[Biometric DB] Deleted subject ID ${subjectId} and all associated embeddings.`);
    return true;
  }

  public queryVector(queryEmbedding: Float32Array, similarityThreshold: number = 0.75): FaceMatch[] {
    const matches: FaceMatch[] = [];

    // Parallel search sweep / Approximate index lookups simulated cleanly over database
    for (const record of this.embeddingsTable) {
      const distance = this.computeCosineSimilarity(queryEmbedding, record.embedding);
      if (distance >= similarityThreshold) {
        const sub = this.subjectsTable.get(record.subjectId);
        if (sub) {
          try {
            const decName = BiometricCryptEngine.decrypt(sub.encryptedName, sub.ivHex, sub.tagHex);
            const decMeta = JSON.parse(BiometricCryptEngine.decrypt(sub.encryptedMeta, sub.ivHex, sub.tagHex));
            matches.push({
              identity: {
                subjectId: sub.subjectId,
                watchlistType: sub.watchlistType,
                fullName: decName,
                metadata: decMeta,
                version: sub.version,
                createdAt: sub.createdAt
              },
              similarityScore: distance
            });
          } catch (e) {
            console.error(`[Biometric DB] Failed to decrypt record for subject ${record.subjectId}:`, e);
          }
        }
      }
    }

    // Sort by highest similarity
    return matches.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  private computeCosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return normB > 0 && normA > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
  }
}

// --- Face Recognition Engine Coordinating Pipeline Class ---

export class BiometricFaceEngine {
  private static instance: BiometricFaceEngine;
  private faceDb = SecureFaceDatabase.getInstance();
  private localLockTracks: Map<string, { identity: BiometricIdentity; confidence: number }> = new Map();
  private unknownRetentionCache: Map<string, { embedding: Float32Array; timestamp: number }> = new Map();

  private constructor() {
    // Self-cleaning cycle for volatile unknown embeddings retention
    setInterval(() => {
      const now = Date.now();
      for (const [key, val] of this.unknownRetentionCache.entries()) {
        if (now - val.timestamp > 86400000) { // 24 Hours auto-expire
          this.unknownRetentionCache.delete(key);
          console.log(`[Biometric Cache] Volatile unknown target ${key} expired and safely purged.`);
        }
      }
    }, 600000); // Check every 10 mins
  }

  public static getInstance(): BiometricFaceEngine {
    if (!BiometricFaceEngine.instance) {
      BiometricFaceEngine.instance = new BiometricFaceEngine();
    }
    return BiometricFaceEngine.instance;
  }

  /**
   * Main real-time pipeline interface.
   * Locked face identities prevent redundant recognition queries over consecutive frames.
   */
  public async processFaceStream(
    cameraId: string,
    framePixels: Uint8Array,
    width: number,
    height: number,
    pipeline: IFacePipeline,
    localTrackId: string,
    timestampMs: number
  ): Promise<FaceMatch | null> {
    const lockKey = `${cameraId}_${localTrackId}`;
    const lockedIdentity = this.localLockTracks.get(lockKey);

    if (lockedIdentity) {
      // 1. Biometric Lock Active. Skip costly embedding & matching runs!
      return {
        identity: lockedIdentity.identity,
        similarityScore: lockedIdentity.confidence
      };
    }

    try {
      // 2. Face Detection
      const detections = await pipeline.detectFaces(framePixels, width, height);
      const face = detections.find(d => d.detectionId === localTrackId);
      if (!face) return null;

      // Publish FaceDetected
      vmsEventService.emit('AI_DETECTION_FINISHED', 'FaceEngine', {
        eventType: BiometricEventType.FACE_DETECTED,
        cameraId,
        localTrackId,
        boundingBox: face.boundingBox,
        confidence: face.confidence
      }, 'INFO');

      // 3. Face Alignment Warp
      const alignedFace = await pipeline.alignAndCrop(framePixels, width, height, face);

      // 4. Quality Assessment gate filter
      const quality = await pipeline.evaluateQuality(alignedFace);
      if (!quality.isUsable || quality.sharpnessScore < 0.5) {
        console.log(`[Biometric Pipeline] Aligned face rejected due to low quality sharpness Score: ${quality.sharpnessScore}`);
        return null; // Reject low-quality blur frames to prevent false matching
      }

      // 5. ArcFace Feature Representation Embedding
      const embedding = await pipeline.extractEmbedding(alignedFace);

      // 6. Two-Pass database matching
      const matches = this.faceDb.queryVector(embedding, 0.75); // threshold 0.75

      if (matches.length > 0) {
        const bestMatch = matches[0];
        // Lock identity for this stream track session
        this.localLockTracks.set(lockKey, {
          identity: bestMatch.identity,
          confidence: bestMatch.similarityScore
        });

        // Publish events depending on Watchlist type
        const type = bestMatch.identity.watchlistType;
        let severity: 'SUCCESS' | 'WARNING' | 'CRITICAL' = 'SUCCESS';
        let eventType = BiometricEventType.FACE_RECOGNIZED;

        if (type === 'BLACKLIST') {
          eventType = BiometricEventType.BLACKLIST_MATCH;
          severity = 'CRITICAL';
        } else if (type === 'WATCHLIST_CUSTOM') {
          eventType = BiometricEventType.WATCHLIST_MATCH;
          severity = 'WARNING';
        } else if (type === 'WHITELIST') {
          eventType = BiometricEventType.WHITELIST_MATCH;
          severity = 'SUCCESS';
        }

        vmsEventService.emit('FACE_RECOGNIZED', 'FaceEngine', {
          eventType,
          cameraId,
          localTrackId,
          subjectId: bestMatch.identity.subjectId,
          subjectName: bestMatch.identity.fullName,
          similarityScore: bestMatch.similarityScore,
          boundingBox: face.boundingBox
        }, severity);

        return bestMatch;
      } else {
        // Unknown Person Handling: Save representation temporarily to volatile tracking retention
        this.unknownRetentionCache.set(lockKey, {
          embedding,
          timestamp: Date.now()
        });

        vmsEventService.emit('AI_DETECTION_FINISHED', 'FaceEngine', {
          eventType: BiometricEventType.UNKNOWN_PERSON,
          cameraId,
          localTrackId,
          boundingBox: face.boundingBox,
          timestamp: new Date().toISOString()
        }, 'WARNING');

        return null;
      }

    } catch (e) {
      vmsEventService.emit('SYSTEM_ERROR', 'FaceEngine', {
        eventType: BiometricEventType.RECOGNITION_FAILED,
        localTrackId,
        cameraId,
        error: (e as Error).message
      }, 'CRITICAL');
      return null;
    }
  }

  public registerFaceTrackLost(cameraId: string, localTrackId: string) {
    const lockKey = `${cameraId}_${localTrackId}`;
    this.localLockTracks.delete(lockKey);
    vmsEventService.emit('AI_DETECTION_FINISHED', 'FaceEngine', {
      eventType: BiometricEventType.FACE_LOST,
      cameraId,
      localTrackId,
      timestamp: new Date().toISOString()
    }, 'INFO');
  }

  public getEnrolledDatabase(): SecureFaceDatabase {
    return this.faceDb;
  }
}
