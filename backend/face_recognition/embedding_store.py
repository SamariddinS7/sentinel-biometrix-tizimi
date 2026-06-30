
import pickle
import os
import logging
from cryptography.fernet import Fernet
from typing import Dict
import numpy as np
from .config import settings

logger = logging.getLogger(__name__)

class EmbeddingStore:
    def __init__(self):
        self.embeddings: Dict[str, np.ndarray] = {}
        try:
            self.cipher = Fernet(settings.ENCRYPTION_KEY.encode())
        except Exception as e:
            logger.critical("Invalid Encryption Key. Secure storage disabled.")
            raise e
        self.load()

    def add_identity(self, person_id: str, embedding: np.ndarray):
        self.embeddings[person_id] = embedding
        self.save()

    def get_all(self) -> Dict[str, np.ndarray]:
        return self.embeddings

    def save(self):
        """Encrypts and saves embeddings to disk."""
        try:
            data = pickle.dumps(self.embeddings)
            encrypted_data = self.cipher.encrypt(data)
            
            # Atomic write to prevent corruption
            tmp_path = settings.STORAGE_PATH + ".tmp"
            dir_name = os.path.dirname(settings.STORAGE_PATH)
            if dir_name and not os.path.exists(dir_name):
                os.makedirs(dir_name)

            with open(tmp_path, "wb") as f:
                f.write(encrypted_data)
            os.replace(tmp_path, settings.STORAGE_PATH)
            logger.info(f"Securely saved {len(self.embeddings)} identities.")
            
        except Exception as e:
            logger.error(f"Failed to secure save embeddings: {e}")

    def load(self):
        """Loads and decrypts embeddings."""
        if not os.path.exists(settings.STORAGE_PATH):
            return

        try:
            with open(settings.STORAGE_PATH, "rb") as f:
                encrypted_data = f.read()
            
            decrypted_data = self.cipher.decrypt(encrypted_data)
            self.embeddings = pickle.loads(decrypted_data)
            logger.info(f"Loaded {len(self.embeddings)} identities from secure storage.")
        except Exception as e:
            logger.error(f"Failed to load secure storage: {e}")
            # Optional: Backup corrupt file
