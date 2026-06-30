
import time
import logging
import threading
from typing import Dict, Set, List
from .zone_manager import zone_manager
from ..face_recognition.audit_logger import AuditLogger
from ..face_recognition.alerting.alert_engine import alert_engine

logger = logging.getLogger("ZoneEngine")

class ZoneState:
    def __init__(self):
        self.current_zones: Set[str] = set()
        self.entry_times: Dict[str, float] = {}

class ZoneEngine:
    """
    Real-time Spatial Security Processor.
    Computes: is_inside(pos, zone)
    Detects: ENTRY, EXIT
    Enforces: POLICIES
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(ZoneEngine, cls).__new__(cls)
                    cls._instance._track_states: Dict[int, ZoneState] = {} # track_id -> ZoneState
                    cls._instance.lock = threading.RLock()
        return cls._instance

    def process_position(self, track_id: int, identity: dict, position_3d: dict, floor_id: str = "FLOOR-1") -> List[dict]:
        """
        Main loop called per-track, per-frame.
        Returns a list of Security Events (Alerts).
        """
        if not position_3d:
            return []

        alerts = []
        now = time.time()

        with self.lock:
            # 1. Initialize State if new
            if track_id not in self._track_states:
                self._track_states[track_id] = ZoneState()
            
            state = self._track_states[track_id]
            prev_zones = state.current_zones.copy()
            
            # 2. Find Current Zones (Spatial Query)
            # Optimization: Only check zones on the same floor
            candidate_zones = zone_manager.get_zones_for_floor(floor_id)
            
            curr_zones = set()
            for zone in candidate_zones:
                if zone.geometry.contains(position_3d):
                    curr_zones.add(zone.id)
            
            # 3. Detect Transitions
            entered = curr_zones - prev_zones
            exited = prev_zones - curr_zones
            stayed = curr_zones.intersection(prev_zones)

            # 4. Handle Entries
            for z_id in entered:
                zone = zone_manager.get_zone(z_id)
                state.entry_times[z_id] = now
                
                # Log Event
                AuditLogger.log_event("ZONE_ENTRY", "SECURITY", "INFO", {
                    "track_id": track_id,
                    "person": identity.get('user_id', 'UNKNOWN'),
                    "zone": zone.name
                })
                
                # Policy Check: Access Control
                if not zone.policy.check_access(identity):
                    alert = self._trigger_alert(track_id, zone, "UNAUTHORIZED_ACCESS", "High", identity)
                    alerts.append(alert)

            # 5. Handle Exits
            for z_id in exited:
                zone = zone_manager.get_zone(z_id)
                entry_time = state.entry_times.pop(z_id, now)
                duration = now - entry_time
                
                AuditLogger.log_event("ZONE_EXIT", "SECURITY", "INFO", {
                    "track_id": track_id,
                    "zone": zone.name,
                    "duration": f"{duration:.1f}s"
                })

            # 6. Handle Dwell Time (Policy Check)
            for z_id in stayed:
                zone = zone_manager.get_zone(z_id)
                entry_time = state.entry_times.get(z_id, now)
                duration = now - entry_time
                
                if not zone.policy.check_dwell_time(duration):
                    # Debounce needed in real system, here we just emit
                    # Simplified: Emit only once every 10s (handled by AlertEngine usually, but we flag here)
                    # For this demo, we'll let AlertEngine handle frequency deduping if we pass it there.
                    # We will return an Alert object.
                    
                    alert = self._trigger_alert(track_id, zone, "MAX_DWELL_EXCEEDED", "Warning", identity)
                    # Simple dedupe check based on time? 
                    # Assuming upstream handles spam, or we just emit.
                    alerts.append(alert)

            # Update State
            state.current_zones = curr_zones

        return alerts

    def _trigger_alert(self, track_id: int, zone, type_code: str, severity: str, identity: dict):
        return {
            "id": f"SEC-{track_id}-{int(time.time())}",
            "severity": "CRITICAL" if severity == "High" else "WARNING",
            "type": type_code,
            "message": f"{type_code}: {identity.get('user_id', 'UNKNOWN')} in {zone.name}",
            "timestamp": time.time() * 1000,
            "entityId": str(track_id),
            "zoneId": zone.id
        }

zone_engine = ZoneEngine()
