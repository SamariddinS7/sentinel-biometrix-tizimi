
from enum import Enum
from typing import List, Optional, Dict
from pydantic import BaseModel, Field
import time

class AttendanceStatus(str, Enum):
    PRESENT = "PRESENT"
    LATE = "LATE"
    ABSENT = "ABSENT"
    EARLY_LEAVE = "EARLY_LEAVE"
    OVERTIME = "OVERTIME"

class SessionState(str, Enum):
    ACTIVE = "ACTIVE"       # Currently visible or in building
    SUSPENDED = "SUSPENDED" # Temporary loss (blind spot)
    CLOSED = "CLOSED"       # Confirmed exit or timeout

class ZoneEvent(BaseModel):
    timestamp: float
    zone_id: str
    type: str # ENTRY / EXIT
    camera_id: str

class AttendanceSession(BaseModel):
    session_id: str
    person_id: str
    date: str
    
    # Time Tracking
    check_in_time: float
    check_out_time: Optional[float] = None
    last_seen_time: float
    
    # State
    state: SessionState = SessionState.ACTIVE
    status_flags: List[AttendanceStatus] = []
    
    # Continuity
    total_duration_seconds: float = 0.0
    gap_duration_seconds: float = 0.0
    
    # Audit
    entry_zone: str
    exit_zone: Optional[str] = None
    events: List[ZoneEvent] = []
    
    # Fraud Prevention
    confidence_avg: float = 0.0
    liveness_checks_passed: int = 0

class DailySummary(BaseModel):
    person_id: str
    date: str
    total_hours: float
    expected_hours: float
    status: AttendanceStatus
    sessions: List[AttendanceSession]
