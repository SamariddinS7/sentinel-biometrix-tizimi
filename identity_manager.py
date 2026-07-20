
import time
from typing import Dict, Optional

class IdentityState:
    def __init__(self, person_id: str, confidence: float, last_verified: float):
        self.person_id = person_id
        self.confidence = confidence
        self.last_verified = last_verified

class IdentityManager:
    """
    Maintains a mapping between Track IDs (from ByteTrack) and Known Identities.
    Handles temporal caching logic.
    """
    def __init__(self, reid_interval: float = 2.0):
        self.track_identities: Dict[int, IdentityState] = {}
        self.reid_interval = reid_interval

    def get_identity(self, track_id: int) -> Optional[IdentityState]:
        return self.track_identities.get(track_id)

    def update_identity(self, track_id: int, person_id: str, confidence: float):
        self.track_identities[track_id] = IdentityState(
            person_id=person_id,
            confidence=confidence,
            last_verified=time.time()
        )

    def should_process(self, track_id: int) -> bool:
        """
        Decides if a track needs recognition (New track OR interval expired).
        """
        if track_id not in self.track_identities:
            return True
        
        state = self.track_identities[track_id]
        
        # If unknown, retry every interval
        # If verified, re-verify every interval to ensure user didn't switch (unlikely in continuous track, but good for security)
        if (time.time() - state.last_verified) > self.reid_interval:
            return True
            
        return False

    def clean_stale(self, active_track_ids: set):
        """Remove identities for tracks that have disappeared."""
        current_ids = set(self.track_identities.keys())
        stale_ids = current_ids - active_track_ids
        for tid in stale_ids:
            del self.track_identities[tid]
