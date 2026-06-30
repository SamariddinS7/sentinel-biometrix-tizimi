
import time
import threading
import logging
import uuid
from typing import Dict, List, Optional
from datetime import datetime

from .config_manager import config_manager
from .audit_logger import AuditLogger
from .attendance.models import AttendanceSession, SessionState, AttendanceStatus, ZoneEvent
from .attendance.rules import AttendanceRules

logger = logging.getLogger("AttendanceEngine")

class AttendanceService:
    """
    Core State Machine for Biometric Attendance.
    
    Flow:
    1. Person Detected -> Check if active session exists.
    2. No Session -> Check if in ENTRY zone -> Create Session (Check-In).
    3. Has Session -> Update last_seen, accumulate duration.
    4. Zone Change -> Log Event.
    5. Timeout/Exit Zone -> Close Session (Check-Out).
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(AttendanceService, cls).__new__(cls)
                    cls._instance._active_sessions: Dict[str, AttendanceSession] = {} # person_id -> Session
                    cls._instance._daily_archive: Dict[str, List[AttendanceSession]] = {} # person_id -> [Sessions]
                    cls._instance.lock = threading.RLock()
                    cls._instance._start_housekeeper()
        return cls._instance

    def process_live_event(self, person_id: str, camera_id: str, zone_id: Optional[str], confidence: float):
        """
        Ingests real-time data from Timeline/Zone engines.
        """
        if person_id == "UNKNOWN" or not person_id:
            return

        now = time.time()
        
        with self.lock:
            session = self._active_sessions.get(person_id)

            # --- SCENARIO A: NEW SESSION ---
            if not session:
                # Strict Entry: Only start if in valid entry zone or if configured to allow camera start
                # For robustness, we usually allow start on any internal camera, assuming they entered.
                # But strict mode requires specific zone.
                is_entry = AttendanceRules.is_valid_entry_zone(zone_id or "") or AttendanceRules.is_valid_entry_zone(camera_id)
                
                if is_entry:
                    flags = AttendanceRules.evaluate_check_in(now)
                    
                    new_session = AttendanceSession(
                        session_id=str(uuid.uuid4()),
                        person_id=person_id,
                        date=datetime.now().strftime("%Y-%m-%d"),
                        check_in_time=now,
                        last_seen_time=now,
                        entry_zone=zone_id or camera_id,
                        status_flags=[AttendanceStatus[f] for f in flags],
                        confidence_avg=confidence
                    )
                    self._active_sessions[person_id] = new_session
                    
                    AuditLogger.log_event("CHECK_IN", "ATTENDANCE", "SUCCESS", {
                        "person": person_id, "time": now, "flags": flags
                    })
                return

            # --- SCENARIO B: UPDATE EXISTING SESSION ---
            
            # 1. Continuity Check
            gap = now - session.last_seen_time
            if gap > config_manager.timeline.merge_gap_seconds:
                # If gap was too long, did they leave and return?
                # If logic allows re-entry merging:
                session.gap_duration_seconds += gap
                # If strict: might close old and start new. We stick to merge for now.
            
            # 2. Update State
            session.state = SessionState.ACTIVE
            session.last_seen_time = now
            session.check_out_time = None # Reset check-out if they reappeared
            
            # Update Duration (Approximate integration)
            # More precise: add (now - prev_last_seen) if gap is small
            if gap < 60: # 1 min continuity threshold
                session.total_duration_seconds += gap
            
            # 3. Zone Logic (Check-Out Detection)
            if zone_id and AttendanceRules.is_exit_zone(zone_id):
                self._close_session(session, reason="EXIT_ZONE")
                return

            # 4. Fraud Prevention Update
            # Moving average of confidence to detect potential spoofing mid-session
            n = session.total_duration_seconds / 5 # approx sample count
            if n > 0:
                session.confidence_avg = (session.confidence_avg * n + confidence) / (n + 1)

    def force_check_out(self, person_id: str, reason="MANUAL"):
        with self.lock:
            session = self._active_sessions.get(person_id)
            if session:
                self._close_session(session, reason)

    def _close_session(self, session: AttendanceSession, reason: str):
        now = time.time()
        session.check_out_time = now
        session.state = SessionState.CLOSED
        session.exit_zone = reason
        
        # Final Rule Evaluation
        out_flags = AttendanceRules.evaluate_check_out(session.check_in_time, now)
        for f in out_flags:
            if f not in session.status_flags:
                session.status_flags.append(AttendanceStatus[f] if f in AttendanceStatus.__members__ else f)

        # Archive
        if session.person_id not in self._daily_archive:
            self._daily_archive[session.person_id] = []
        self._daily_archive[session.person_id].append(session)
        
        del self._active_sessions[session.person_id]
        
        AuditLogger.log_event("CHECK_OUT", "ATTENDANCE", "SUCCESS", {
            "person": session.person_id, 
            "duration_hours": round(session.total_duration_seconds/3600, 2),
            "reason": reason
        })

    def get_today_summary(self, person_id: str) -> Optional[dict]:
        with self.lock:
            # Combine active + archived
            sessions = self._daily_archive.get(person_id, [])
            active = self._active_sessions.get(person_id)
            
            all_sessions = sessions + ([active] if active else [])
            
            if not all_sessions: return None
            
            first_in = min(s.check_in_time for s in all_sessions)
            last_out = max((s.check_out_time or s.last_seen_time) for s in all_sessions)
            total_dur = sum(s.total_duration_seconds for s in all_sessions)
            
            status = "PRESENT" if active else "CHECKED_OUT"
            # If any session was late, mark day as late
            if any(AttendanceStatus.LATE in s.status_flags for s in all_sessions):
                status = "LATE"
                
            return {
                "person_id": person_id,
                "first_in": time.strftime("%H:%M", time.localtime(first_in)),
                "last_out": time.strftime("%H:%M", time.localtime(last_out)),
                "total_hours": round(total_dur / 3600, 2),
                "status": status,
                "session_count": len(all_sessions)
            }

    def _start_housekeeper(self):
        """Checks for abandoned sessions (timeouts)"""
        def loop():
            while True:
                time.sleep(60)
                self._check_timeouts()
        
        t = threading.Thread(target=loop, name="AttendanceGC", daemon=True)
        t.start()

    def _check_timeouts(self):
        now = time.time()
        # Auto-checkout after N hours of silence
        timeout = config_manager.timeline.exit_timeout_seconds * 10 # Graceful multiplier
        # Or absolute time (e.g. 3 AM)
        
        with self.lock:
            to_close = []
            for pid, session in self._active_sessions.items():
                if (now - session.last_seen_time) > 3600: # 1 hour of total silence
                    to_close.append(session)
            
            for s in to_close:
                logger.info(f"Auto-closing session for {s.person_id} due to inactivity.")
                self._close_session(s, reason="TIMEOUT")

attendance_service = AttendanceService()
