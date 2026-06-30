
import logging
from typing import List, Dict
from .coverage_engine import CoverageEngine
from ..face_recognition.audit_logger import AuditLogger

logger = logging.getLogger("ZoneManager")

class ZoneManager:
    """
    Detects if tracked persons are inside specific zones.
    """
    
    def __init__(self):
        self.zones: Dict[str, dict] = {} # { id: { points: [], type: '' } }

    def register_zone(self, zone_id: str, zone_def: dict):
        self.zones[zone_id] = zone_def

    def check_presence(self, x: float, y: float) -> List[str]:
        """
        Returns list of zone IDs that contain the point (x,y).
        """
        present_in = []
        for z_id, zone in self.zones.items():
            # Convert points dict to tuple list if needed
            poly = [(p['x'], p['y']) for p in zone['points']]
            
            if CoverageEngine.is_point_in_polygon((x, y), poly):
                present_in.append(z_id)
        
        return present_in

    def process_zone_events(self, track_id: str, person_name: str, prev_zones: List[str], curr_zones: List[str]):
        """
        Detects Entry/Exit events and logs them.
        """
        prev_set = set(prev_zones)
        curr_set = set(curr_zones)
        
        entered = curr_set - prev_set
        exited = prev_set - curr_set
        
        for z_id in entered:
            zone_type = self.zones[z_id].get('type', 'generic')
            level = "WARNING" if zone_type == 'restricted' else "INFO"
            
            AuditLogger.log_event("ZONE_ENTRY", "SPATIAL", level, {
                "track_id": track_id,
                "person": person_name,
                "zone_id": z_id,
                "zone_type": zone_type
            })
            
        for z_id in exited:
            AuditLogger.log_event("ZONE_EXIT", "SPATIAL", "INFO", {
                "track_id": track_id,
                "person": person_name,
                "zone_id": z_id
            })

zone_manager = ZoneManager()
