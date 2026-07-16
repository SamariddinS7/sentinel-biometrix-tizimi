/**
 * Sentinel VMS — Playback Engine
 *
 * Provides timeline-based playback of recorded video segments.
 * Supports time-based search, frame-accurate seeking, speed control,
 * pause, resume, and streaming URLs for recorded clips.
 *
 * Playback sessions are stateful and scoped to a session ID.
 * The engine does NOT re-encode — it serves existing recorded files.
 */

import { EventEmitter } from 'events';
import { db } from '../firestoreService';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4 | 8;
export type PlaybackState = 'IDLE' | 'PLAYING' | 'PAUSED' | 'SEEKING' | 'ENDED' | 'ERROR';

export interface TimelineSegment {
  segmentId: string;
  cameraId: string;
  startTime: number;   // Unix ms
  endTime: number;     // Unix ms
  durationSec: number;
  filePath: string;
  fileSizeBytes: number;
  recordingType: string;
  codec?: string;
  resolution?: string;
}

export interface PlaybackSession {
  sessionId: string;
  cameraId: string;
  startTimeMs: number;
  endTimeMs: number;
  currentPositionMs: number;
  speed: PlaybackSpeed;
  state: PlaybackState;
  segments: TimelineSegment[];
  activeSegmentIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybackSessionSummary {
  sessionId: string;
  cameraId: string;
  state: PlaybackState;
  currentPositionMs: number;
  durationMs: number;
  speed: PlaybackSpeed;
  segmentCount: number;
}

class PlaybackEngine extends EventEmitter {
  private static instance: PlaybackEngine;
  private sessions: Map<string, PlaybackSession> = new Map();

  private constructor() {
    super();
  }

  public static getInstance(): PlaybackEngine {
    if (!PlaybackEngine.instance) {
      PlaybackEngine.instance = new PlaybackEngine();
    }
    return PlaybackEngine.instance;
  }

  /**
   * Create a playback session for a time range.
   * Queries Firestore for all recording segments within the window.
   */
  public async createSession(
    cameraId: string,
    startTimeMs: number,
    endTimeMs: number,
  ): Promise<PlaybackSession> {
    const sessionId = `pb_${cameraId}_${Date.now()}`;
    const segments = await this.querySegments(cameraId, startTimeMs, endTimeMs);

    const session: PlaybackSession = {
      sessionId,
      cameraId,
      startTimeMs,
      endTimeMs,
      currentPositionMs: startTimeMs,
      speed: 1,
      state: segments.length > 0 ? 'IDLE' : 'ERROR',
      segments,
      activeSegmentIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);
    this.emit('sessionCreated', { sessionId, cameraId, segmentCount: segments.length });
    return session;
  }

  /** Start or resume playback */
  public play(sessionId: string): void {
    const session = this.requireSession(sessionId);
    if (session.state === 'ENDED' || session.state === 'ERROR') {
      throw new Error(`Cannot play session in state: ${session.state}`);
    }
    session.state = 'PLAYING';
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
    this.emit('stateChange', { sessionId, state: 'PLAYING' });
  }

  /** Pause playback */
  public pause(sessionId: string): void {
    const session = this.requireSession(sessionId);
    if (session.state !== 'PLAYING') return;
    session.state = 'PAUSED';
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
    this.emit('stateChange', { sessionId, state: 'PAUSED' });
  }

  /** Seek to an absolute position (Unix ms within the session window) */
  public seek(sessionId: string, positionMs: number): void {
    const session = this.requireSession(sessionId);

    const clamped = Math.max(session.startTimeMs, Math.min(session.endTimeMs, positionMs));
    session.state = 'SEEKING';
    session.currentPositionMs = clamped;

    // Find the segment that contains this position
    const idx = session.segments.findIndex(
      s => s.startTime <= clamped && s.endTime >= clamped,
    );
    session.activeSegmentIndex = idx >= 0 ? idx : 0;
    session.state = 'PAUSED';
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
    this.emit('seeked', { sessionId, positionMs: clamped, segmentIndex: session.activeSegmentIndex });
  }

  /** Set playback speed */
  public setSpeed(sessionId: string, speed: PlaybackSpeed): void {
    const session = this.requireSession(sessionId);
    session.speed = speed;
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
    this.emit('speedChanged', { sessionId, speed });
  }

  /** Advance position by the given number of milliseconds (used by playback loop) */
  public advancePosition(sessionId: string, deltaMs: number): void {
    const session = this.requireSession(sessionId);
    if (session.state !== 'PLAYING') return;

    session.currentPositionMs += deltaMs * session.speed;

    if (session.currentPositionMs >= session.endTimeMs) {
      session.currentPositionMs = session.endTimeMs;
      session.state = 'ENDED';
      this.emit('ended', { sessionId });
    }

    // Update active segment
    const idx = session.segments.findIndex(
      s => s.startTime <= session.currentPositionMs && s.endTime >= session.currentPositionMs,
    );
    if (idx >= 0) session.activeSegmentIndex = idx;

    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
  }

  /** Get the file path and byte offset for the current playback position */
  public getCurrentSegmentInfo(sessionId: string): {
    segment: TimelineSegment | null;
    offsetMs: number;
    streamUrl: string | null;
  } {
    const session = this.requireSession(sessionId);
    const seg = session.segments[session.activeSegmentIndex] ?? null;
    if (!seg) return { segment: null, offsetMs: 0, streamUrl: null };

    const offsetMs = Math.max(0, session.currentPositionMs - seg.startTime);
    // Production: Generate a signed streaming URL pointing to the segment file
    // via the recording storage provider (NAS/SAN/Object store).
    const streamUrl = `/api/cameras/${session.cameraId}/playback/stream?sessionId=${sessionId}&segmentId=${seg.segmentId}&offsetMs=${offsetMs}`;

    return { segment: seg, offsetMs, streamUrl };
  }

  /** Close and clean up a playback session */
  public closeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.emit('sessionClosed', { sessionId });
  }

  public getSession(sessionId: string): PlaybackSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  public listSessions(cameraId?: string): PlaybackSessionSummary[] {
    return Array.from(this.sessions.values())
      .filter(s => !cameraId || s.cameraId === cameraId)
      .map(s => ({
        sessionId: s.sessionId,
        cameraId: s.cameraId,
        state: s.state,
        currentPositionMs: s.currentPositionMs,
        durationMs: s.endTimeMs - s.startTimeMs,
        speed: s.speed,
        segmentCount: s.segments.length,
      }));
  }

  // ─── Query ─────────────────────────────────────────────────────────────────

  public async querySegments(
    cameraId: string,
    startMs: number,
    endMs: number,
  ): Promise<TimelineSegment[]> {
    try {
      const q = query(
        collection(db, 'recordings'),
        where('cameraId', '==', cameraId),
        orderBy('startTime', 'asc'),
      );
      const snap = await getDocs(q);
      return snap.docs
        .map(d => {
          const data = d.data();
          const segStart = new Date(data.startTime).getTime();
          const segEnd = new Date(data.endTime ?? data.startTime).getTime();
          return {
            segmentId: d.id,
            cameraId: data.cameraId,
            startTime: segStart,
            endTime: segEnd,
            durationSec: data.durationSec ?? (segEnd - segStart) / 1000,
            filePath: data.filePath ?? '',
            fileSizeBytes: Math.round((data.fileSizeMb ?? 0) * 1024 * 1024),
            recordingType: data.recordingType ?? 'CONTINUOUS',
            codec: data.codec,
            resolution: data.resolution,
          } as TimelineSegment;
        })
        .filter(s => s.startTime < endMs && s.endTime > startMs);
    } catch {
      return [];
    }
  }

  public async searchRecordingsByTime(
    cameraId: string,
    startMs: number,
    endMs: number,
  ): Promise<TimelineSegment[]> {
    return this.querySegments(cameraId, startMs, endMs);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private requireSession(sessionId: string): PlaybackSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Playback session not found: ${sessionId}`);
    return session;
  }
}

export const playbackEngine = PlaybackEngine.getInstance();
