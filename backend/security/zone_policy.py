
from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class ZonePolicy:
    """
    Security Rules for a specific Zone.
    """
    zone_id: str
    allowed_roles: List[str] = field(default_factory=lambda: ["ADMIN", "OPERATOR", "EMPLOYEE"])
    max_dwell_time_sec: int = 0 # 0 = Unlimited
    requires_liveness: bool = False
    allowed_time_window: Optional[tuple] = None # (start_hour, end_hour) e.g., (9, 17)
    
    def check_access(self, identity: dict) -> bool:
        """
        Validates if the person is allowed in the zone.
        """
        role = identity.get('role', 'UNKNOWN')
        
        # 1. Role Check
        if role not in self.allowed_roles:
            return False
            
        return True

    def check_dwell_time(self, duration: float) -> bool:
        """
        Checks if person has stayed too long.
        """
        if self.max_dwell_time_sec > 0:
            if duration > self.max_dwell_time_sec:
                return False # Violation
        return True
