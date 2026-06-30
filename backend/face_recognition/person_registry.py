
import threading
import time
import logging
from typing import Dict, Optional, List
from dataclasses import dataclass
from .config_manager import config_manager

logger = logging.getLogger("PersonRegistry")

@dataclass
class IdentityState:
    user_id: str
    confidence: float
    last_verified_at: float 
    status: str # 'VERIFIED' | 'UNKNOWN' | 'AMBIGUOUS'

class PersonRegistry:
    """
    Authoritative Cache for Identity State.
    Enforces "Sticky" Unknown Status.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(PersonRegistry, cls).__new__(cls)
                    cls._instance._registry = {} # Map[track_id, IdentityState]
                    cls._instance.registry_lock = threading.RLock()
        return cls._instance

    def needs_recognition(self, track_id: int) -> bool:
        """
        Determines if recognition logic needs to run.
        """
        with self.registry_lock:
            if track_id not in self._registry:
                return True
            
            # Check re-id interval
            identity = self._registry[track_id]
            interval = config_manager.recognition.reidentification_interval
            if (time.time() - identity.last_verified_at) > interval:
                return True
                
            return False

    def get_identity(self, track_id: int) -> Dict:
        """Returns format ready for API/Frontend"""
        with self.registry_lock:
            if track_id in self._registry:
                id_state = self._registry[track_id]
                
                # Logic Mapping: AMBIGUOUS is presented as UNKNOWN to frontend for safety
                display_status = id_state.status
                if display_status == "AMBIGUOUS":
                    display_status = "UNKNOWN"
                    
                return {
                    "user_id": id_state.user_id,
                    "confidence": id_state.confidence,
                    "status": display_status
                }
            return {
                "user_id": None,
                "confidence": 0.0,
                "status": "DETECTING"
            }

    def update_identity(self, track_id: int, user_id: str, confidence: float, status: str):
        """
        Updates registry with Strict Persistence Rules.
        """
        with self.registry_lock:
            current_state = self._registry.get(track_id)
            
            # DEFAULT: Just update
            should_update = True
            
            if current_state:
                # RULE 1: Sticky UNKNOWN
                if current_state.status in ["UNKNOWN", "AMBIGUOUS"] and status == "VERIFIED":
                    recovery_margin = 0.05
                    required_score = config_manager.recognition.known_threshold + recovery_margin
                    if confidence < required_score:
                        should_update = False
                
                # RULE 2: Sticky VERIFIED
                elif current_state.status == "VERIFIED" and status in ["UNKNOWN", "AMBIGUOUS"]:
                     should_update = False

            if should_update:
                self._registry[track_id] = IdentityState(
                    user_id=user_id,
                    confidence=confidence,
                    last_verified_at=time.time(),
                    status=status
                )

    def prune(self, active_track_ids: list):
        """Removes tracks that are no longer reported by the tracker."""
        with self.registry_lock:
            active_set = set(active_track_ids)
            keys_to_remove = [k for k in self._registry.keys() if k not in active_set]
            for k in keys_to_remove:
                del self._registry[k]

    # --- PRIVACY & RETENTION METHODS ---

    def find_expired_identities(self, cutoff_timestamp: float) -> List[str]:
        """Finds IDs that haven't been seen since cutoff_timestamp (for Retention Policy)."""
        expired = []
        with self.registry_lock:
            for track_id, state in self._registry.items():
                if state.last_verified_at < cutoff_timestamp:
                    expired.append(state.user_id) # In a real DB, we'd return DB IDs
        return list(set(expired)) # Unique users

    def purge_identity(self, user_id: str) -> int:
        """
        GDPR Erasure: Removes all traces of a User ID from active memory.
        """
        count = 0
        with self.registry_lock:
            # Find all tracks associated with this user
            tracks_to_remove = [k for k, v in self._registry.items() if v.user_id == user_id]
            for t_id in tracks_to_remove:
                del self._registry[t_id]
                count += 1
        return count

person_registry = PersonRegistry()
