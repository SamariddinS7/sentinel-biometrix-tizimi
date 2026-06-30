
import logging
import threading
from typing import Dict, List
from .zone_geometry import ZoneVolume
from .zone_policy import ZonePolicy

logger = logging.getLogger("ZoneManager")

class Zone:
    def __init__(self, id: str, name: str, floor_id: str, geometry: ZoneVolume, policy: ZonePolicy):
        self.id = id
        self.name = name
        self.floor_id = floor_id
        self.geometry = geometry
        self.policy = policy

class ZoneManager:
    """
    Authoritative Source of Truth for Spatial Security Zones.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(ZoneManager, cls).__new__(cls)
                    cls._instance._zones: Dict[str, Zone] = {}
                    cls._instance._load_default_zones()
        return cls._instance

    def _load_default_zones(self):
        # Mocking DB Load - In prod, load from DB
        logger.info("Loading Default Security Zones...")
        
        # Server Room (Restricted)
        self.register_zone(
            id="Z3D-SERVER",
            name="Restricted Server Room",
            floor_id="FLOOR-1",
            position={'x': -8, 'y': 1.5, 'z': -8},
            dimensions={'x': 6, 'y': 3, 'z': 6},
            policy=ZonePolicy(
                zone_id="Z3D-SERVER",
                allowed_roles=["ADMIN"], # Strict
                max_dwell_time_sec=300
            )
        )

        # Lobby (Transit)
        self.register_zone(
            id="Z3D-LOBBY",
            name="Main Lobby",
            floor_id="FLOOR-1",
            position={'x': 0, 'y': 1.5, 'z': 2},
            dimensions={'x': 12, 'y': 3, 'z': 10},
            policy=ZonePolicy(
                zone_id="Z3D-LOBBY",
                allowed_roles=["ADMIN", "OPERATOR", "EMPLOYEE", "VISITOR", "UNKNOWN"],
                max_dwell_time_sec=0
            )
        )

    def register_zone(self, id: str, name: str, floor_id: str, position: dict, dimensions: dict, policy: ZonePolicy):
        volume = ZoneVolume(position, dimensions)
        zone = Zone(id, name, floor_id, volume, policy)
        self._zones[id] = zone
        logger.info(f"Registered Zone: {name} [{id}] on {floor_id}")

    def get_zones_for_floor(self, floor_id: str) -> List[Zone]:
        return [z for z in self._zones.values() if z.floor_id == floor_id]

    def get_zone(self, zone_id: str) -> Zone:
        return self._zones.get(zone_id)

zone_manager = ZoneManager()
