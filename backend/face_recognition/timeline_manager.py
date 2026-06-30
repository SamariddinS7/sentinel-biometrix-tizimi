
import time
import logging
import threading
from enum import Enum
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from .config_manager import config_manager
from .audit_logger import AuditLogger
from .attendance_service import attendance_service
from .alerting.alert_engine import alert_engine

logger = logging.getLogger("TimelineManager")

class TimelineStatus(str, Enum):
    NEW = "NEW"
    VISIBLE = "VISIBLE"
    LOST = "LOST"     # Temporarily occluded / missing
    EXITED = "EXITED" # Definitely gone

@dataclass
class TrackTimeline:
    track_id: int
    camera_id: str
    person_id: str # 'UNKNOWN' or User ID
    first_seen: float
    last_seen: float
    total_duration: float
    status: TimelineStatus
    meta: Dict = field(default_factory=dict)

    def is_active(self):
        return self.status != TimelineStatus.EXITED

class TimelineManager:
    """
    Temporal State Machine for Biometric Tracks.
    Authoritative source for "Duration" and "Presence".
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(TimelineManager, cls).__new__(cls)
                    cls._instance._sessions = {} # Dict[track_id, TrackTimeline]
                    cls._instance._lock = threading.RLock()
                    cls._instance.active_alerts = []
        return cls._instance

    def update(self, camera_id: str, active_tracks_data: List[dict]):
        """
        Called every frame with currently visible tracks.
        active_tracks_data: List[{'track_id': int, 'person_id': str, 'meta': dict}]
        """
        now = time.time()
        conf = config_manager.timeline

        # Prepare list for Alert Engine
        alert_candidates = []

        with self._lock:
            active_ids = set()

            # 1. UPDATE or CREATE sessions
            for data in active_tracks_data:
                t_id = data['track_id']
                p_id = data['person_id']
                active_ids.add(t_id)

                if t_id in self._sessions:
                    # Update Existing
                    session = self._sessions[t_id]
                    
                    # Update Duration: Add delta since last_seen (if reasonable)
                    delta = now - session.last_seen
                    if delta < 5.0: 
                        session.total_duration += delta
                    
                    session.last_seen = now
                    session.status = TimelineStatus.VISIBLE
                    session.person_id = p_id 
                    session.meta = data.get('meta', {})
                else:
                    # Create New
                    self._sessions[t_id] = TrackTimeline(
                        track_id=t_id,
                        camera_id=camera_id,
                        person_id=p_id,
                        first_seen=now,
                        last_seen=now,
                        total_duration=0.0,
                        status=TimelineStatus.NEW,
                        meta=data.get('meta', {})
                    )
                    session = self._sessions[t_id]
                    AuditLogger.log_event("TRACK_ENTER", "TIMELINE", "INFO", {"track_id": t_id, "person_id": p_id})

                # Add to alert candidates
                alert_candidates.append({
                    "track_id": t_id,
                    "person_id": p_id,
                    "duration": session.total_duration
                })

            # 2. HANDLE MISSING TRACKS (State Machine)
            cam_sessions = {k: v for k, v in self._sessions.items() if v.camera_id == camera_id and v.is_active()}
            
            for t_id, session in cam_sessions.items():
                if t_id not in active_ids:
                    time_lost = now - session.last_seen
                    
                    if time_lost > conf.exit_timeout_seconds:
                        session.status = TimelineStatus.EXITED
                        self._finalize_session(session)
                    elif time_lost > conf.lost_timeout_seconds:
                        session.status = TimelineStatus.LOST

            # 3. RUN ALERT ENGINE
            # Check for Unknown Loitering
            self.active_alerts = alert_engine.process_timeline_update(camera_id, alert_candidates)

    def get_display_data(self, track_id: int) -> dict:
        """Returns rich timeline data for UI"""
        with self._lock:
            if track_id in self._sessions:
                s = self._sessions[track_id]
                return {
                    "duration_sec": round(s.total_duration, 1),
                    "arrival_ts": s.first_seen,
                    "status": s.status.value
                }
            return {}
            
    def get_latest_alerts(self) -> List[dict]:
        """Returns alerts generated in the last frame"""
        return self.active_alerts

    def _finalize_session(self, session: TrackTimeline):
        """
        Archive session and send to Attendance Service.
        """
        logger.info(f"Session Finalized: Track {session.track_id} ({session.person_id}) - Duration: {session.total_duration:.1f}s")
        
        if session.person_id == "UNKNOWN":
            alert_engine.register_unknown_exit()

        attendance_service.record_session(
            person_id=session.person_id,
            camera_id=session.camera_id,
            start_time=session.first_seen,
            end_time=session.last_seen,
            duration=session.total_duration
        )

        if session.track_id in self._sessions:
            del self._sessions[session.track_id]
        
        AuditLogger.log_event("TRACK_EXIT", "TIMELINE", "INFO", {
            "track_id": session.track_id, 
            "person_id": session.person_id,
            "duration": session.total_duration
        })

timeline_manager = TimelineManager()
