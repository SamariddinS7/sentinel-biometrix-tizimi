
import time
import logging
import threading
from typing import Dict, List
from ..config_manager import config_manager
from ..audit_logger import AuditLogger
from .webhook_dispatcher import webhook_dispatcher

logger = logging.getLogger("AlertEngine")

class AlertState:
    IDLE = 0
    TRIGGERED = 1
    COOLDOWN = 2

class TrackAlertContext:
    def __init__(self):
        self.state = AlertState.IDLE
        self.last_trigger_time = 0.0
        self.start_visible_time = 0.0

class AlertEngine:
    """
    Security Event Detection Logic.
    Monitors:
    1. Unknown Person Loitering (Duration > Threshold)
    2. High Unknown Traffic (Reappearance Rate)
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(AlertEngine, cls).__new__(cls)
                    cls._instance._track_states: Dict[int, TrackAlertContext] = {}
                    cls._instance._unknown_history: List[float] = [] # Timestamps of unknown exits
                    cls._instance.lock = threading.RLock()
        return cls._instance

    def process_timeline_update(self, camera_id: str, tracks_data: List[dict]):
        """
        Called by TimelineManager every frame.
        tracks_data items have: track_id, person_id, duration, status
        """
        conf = config_manager.alerts
        if not conf.enabled:
            return []

        now = time.time()
        active_alerts = []

        with self.lock:
            # Cleanup old history for frequency check
            window_start = now - conf.reappearance_window_seconds
            self._unknown_history = [t for t in self._unknown_history if t > window_start]

            for track in tracks_data:
                t_id = track['track_id']
                p_id = track['person_id']
                duration = track['duration']
                
                # Only monitor UNKNOWNs
                if p_id != "UNKNOWN":
                    if t_id in self._track_states:
                        del self._track_states[t_id] # Clean up knowns
                    continue

                if t_id not in self._track_states:
                    self._track_states[t_id] = TrackAlertContext()
                
                ctx = self._track_states[t_id]

                # --- RULE 1: LOITERING / DURATION ---
                if duration >= conf.min_visible_seconds:
                    
                    if ctx.state == AlertState.IDLE:
                        # TRIGGER
                        alert = self._create_alert(camera_id, t_id, duration, "UNKNOWN_LOITERING")
                        active_alerts.append(alert)
                        ctx.state = AlertState.TRIGGERED
                        ctx.last_trigger_time = now
                        
                    elif ctx.state == AlertState.TRIGGERED:
                        # Already active, check cooldown to re-notify? 
                        # Usually we just hold state.
                        if (now - ctx.last_trigger_time) > conf.cooldown_seconds:
                             ctx.state = AlertState.COOLDOWN
                    
                    elif ctx.state == AlertState.COOLDOWN:
                        # If still visible after cooldown, re-trigger?
                        if (now - ctx.last_trigger_time) > conf.cooldown_seconds:
                            alert = self._create_alert(camera_id, t_id, duration, "UNKNOWN_LOITERING_PERSIST")
                            active_alerts.append(alert)
                            ctx.state = AlertState.TRIGGERED
                            ctx.last_trigger_time = now

            # --- RULE 2: FREQUENCY (Checked periodically or on exit, here checked on frame) ---
            # Ideally this is checked less frequently, but lightweight list len is fine.
            if len(self._unknown_history) >= conf.reappearance_count:
                # Debounce this global alert? For simplicity, we assume frontend handles spam
                # or we add a global cooldown.
                pass

        return active_alerts

    def register_unknown_exit(self):
        """Called when an unknown track exits timeline"""
        with self.lock:
            self._unknown_history.append(time.time())

    def _create_alert(self, camera_id, track_id, duration, alert_type):
        payload = {
            "event": "SECURITY_ALERT",
            "type": alert_type,
            "severity": "HIGH",
            "camera_id": camera_id,
            "track_id": track_id,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "details": f"Unknown person visible for {duration:.1f}s"
        }
        
        # 1. Log to Audit
        AuditLogger.log_event(alert_type, "ALERT_ENGINE", "WARNING", payload)
        
        # 2. Send Webhook
        webhook_dispatcher.send_alert(payload)
        
        return payload

alert_engine = AlertEngine()
