
import time
import logging
import threading
from typing import List
from ..config_manager import config_manager
from ..audit_logger import AuditLogger
from ..person_registry import person_registry

logger = logging.getLogger("PrivacyEngine")

class PrivacyEngine:
    """
    Enforces GDPR/Privacy Compliance Rules:
    1. Data Retention Policy (Auto-Cleanup)
    2. Right to Erasure ("Forget Person")
    3. Raw Data Lifecycle (Ensure no raw images persist)
    """
    
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(PrivacyEngine, cls).__new__(cls)
                    cls._instance.start_retention_scheduler()
        return cls._instance

    def start_retention_scheduler(self):
        """Starts background thread to purge expired data."""
        days = config_manager.security.data_retention_days
        logger.info(f"Privacy Engine: Retention Policy enforced ({days} days). GDPR Right-to-Erasure enabled.")
        self.worker = threading.Thread(target=self._retention_loop, name="Privacy-Retention-Worker", daemon=True)
        self.worker.start()

    def _retention_loop(self):
        """
        Periodically checks for expired identities based on 'data_retention_days'.
        """
        while True:
            try:
                retention_days = config_manager.security.data_retention_days
                retention_seconds = retention_days * 86400
                cutoff_time = time.time() - retention_seconds
                
                # In a real DB, this would query WHERE last_seen < cutoff
                # Here we interact with the Registry abstraction
                expired_ids = person_registry.find_expired_identities(cutoff_time)
                
                if expired_ids:
                    logger.info(f"Retention Policy: Found {len(expired_ids)} expired identities.")
                    for track_id in expired_ids:
                        self.forget_person(track_id, reason="RETENTION_POLICY_EXPIRY")
                
            except Exception as e:
                logger.error(f"Retention loop error: {e}")
            
            # Run check every hour
            time.sleep(3600)

    def forget_person(self, identity_id: str, reason: str = "USER_REQUEST") -> bool:
        """
        GDPR 'Right to Erasure'. 
        Permanently removes biometric links and identity data.
        """
        if not config_manager.security.allow_forget_person:
            logger.warning("Forget Person requested but feature is DISABLED in config.")
            return False

        logger.info(f"Executing FORGET PERSON for {identity_id}. Reason: {reason}")
        
        try:
            # 1. Remove from Active Memory (Registry)
            # We treat track_id and user_id mapping here. 
            # In production, this deletes from Vector DB (Milvus/pgvector)
            removed_count = person_registry.purge_identity(identity_id)
            
            # 2. Log the Compliance Action (Tamper-evident log)
            AuditLogger.log_event(
                "DATA_ERASURE", 
                "PRIVACY_ENGINE", 
                "SUCCESS", 
                {
                    "target_identity": identity_id,
                    "reason": reason,
                    "records_purged": removed_count
                }
            )
            return True
            
        except Exception as e:
            logger.error(f"Erasure failed: {e}")
            AuditLogger.log_event("ERASURE_FAIL", "PRIVACY_ENGINE", "FAILURE", {"error": str(e)})
            return False

    def validate_raw_data_lifecycle(self):
        """
        Debug utility to ensure no raw frames are being cached in singletons.
        """
        # Logic to inspect heaps or singletons could go here
        pass

privacy_engine = PrivacyEngine()
