
import time
import threading
import uuid
import logging
from typing import Dict, Optional
from ..config_manager import config_manager
from ..security.crypto import BiometricEncryptor
from ..audit_logger import AuditLogger
from .snapshot_processor import SnapshotProcessor

logger = logging.getLogger("SnapshotService")

class StoredSnapshot:
    def __init__(self, encrypted_data: bytes, created_at: float, ttl: int):
        self.data = encrypted_data
        self.created_at = created_at
        self.expires_at = created_at + ttl

class SnapshotService:
    """
    Secure In-Memory Storage for Evidence Snapshots.
    Enforces TTL (Auto-Deletion) and Encryption-at-Rest (in RAM).
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(SnapshotService, cls).__new__(cls)
                    cls._instance._store: Dict[str, StoredSnapshot] = {}
                    cls._instance.lock = threading.RLock()
                    cls._instance._start_cleanup_worker()
        return cls._instance

    def _start_cleanup_worker(self):
        t = threading.Thread(target=self._cleanup_loop, name="SnapshotGC", daemon=True)
        t.start()

    def capture(self, frame, bbox, track_id, camera_id, reason="AUDIT") -> Optional[str]:
        """
        Processes and stores a snapshot securely.
        Returns: snapshot_id (str)
        """
        conf = config_manager.snapshot
        if not conf.enabled: 
            return None

        # 1. Process (Blur/Resize)
        img_bytes = SnapshotProcessor.process(frame, bbox)
        if not img_bytes:
            return None

        # 2. Encrypt
        encrypted_blob = BiometricEncryptor.encrypt_embedding(img_bytes) # Reusing AES logic
        if not encrypted_blob:
            return None

        snapshot_id = str(uuid.uuid4())
        
        with self.lock:
            self._store[snapshot_id] = StoredSnapshot(
                encrypted_data=encrypted_blob,
                created_at=time.time(),
                ttl=conf.ttl_seconds
            )

        AuditLogger.log_event("SNAPSHOT_CREATED", "SNAPSHOT_SVC", "INFO", {
            "id": snapshot_id,
            "track_id": track_id,
            "reason": reason,
            "expires_in": conf.ttl_seconds
        })
        
        return snapshot_id

    def get_snapshot(self, snapshot_id: str) -> Optional[bytes]:
        """
        Retrieves and decrypts a snapshot.
        Returns raw bytes (WebP) or None if expired/missing.
        """
        with self.lock:
            record = self._store.get(snapshot_id)
            if not record:
                return None
            
            # Check Expiry on Access (Lazy Deletion)
            if time.time() > record.expires_at:
                del self._store[snapshot_id]
                return None

            # Decrypt
            decrypted = BiometricEncryptor.decrypt_embedding(record.data)
            return decrypted

    def _cleanup_loop(self):
        """Background GC for expired snapshots"""
        while True:
            time.sleep(60) # Check every minute
            now = time.time()
            deleted_count = 0
            
            with self.lock:
                keys_to_delete = [k for k, v in self._store.items() if now > v.expires_at]
                for k in keys_to_delete:
                    del self._store[k]
                    deleted_count += 1
            
            if deleted_count > 0:
                logger.info(f"Snapshot GC: Purged {deleted_count} expired records.")

snapshot_service = SnapshotService()
