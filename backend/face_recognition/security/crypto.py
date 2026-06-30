
import os
import json
import numpy as np
from cryptography.fernet import Fernet
import logging
from ..config import settings
from ..audit_logger import AuditLogger

logger = logging.getLogger("BiometricCrypto")

class BiometricEncryptor:
    """
    Mandatory AES-256 Encryption Layer for Biometric Data.
    Enforces 'Encryption at Rest' compliance.
    """
    _cipher = None

    @classmethod
    def _get_cipher(cls):
        if cls._cipher is None:
            cls._load_or_generate_key()
        return cls._cipher

    @classmethod
    def _load_or_generate_key(cls):
        """
        Securely loads the Master Key.
        If key is missing, generates a new one (In prod, this should use HSM/Vault).
        """
        key_path = settings.ENCRYPTION_KEY_FILE
        try:
            if os.path.exists(key_path):
                with open(key_path, "rb") as f:
                    key = f.read()
            else:
                logger.warning("⚠️ MASTER KEY NOT FOUND. Generating new secure key.")
                key = Fernet.generate_key()
                with open(key_path, "wb") as f:
                    f.write(key)
                # Restrict permissions to owner-read only (chmod 600)
                try:
                    os.chmod(key_path, 0o600)
                except Exception:
                    pass
                
                AuditLogger.log_event("KEY_GENERATION", "CRYPTO", "WARNING", {"path": key_path})
            
            cls._cipher = Fernet(key)
            
        except Exception as e:
            logger.critical(f"FATAL: Key Management Failure: {e}")
            AuditLogger.log_event("KEY_LOAD_FAIL", "CRYPTO", "FAILURE", {"error": str(e)})
            raise RuntimeError("Biometric Security System failed to initialize crypto subsystem.")

    @classmethod
    def encrypt_embedding(cls, embedding: np.ndarray) -> bytes:
        """
        Encrypts a numpy embedding vector using AES-256.
        """
        if embedding is None:
            return None

        try:
            # 1. Serialize using JSON for security (No Pickle RCE vulnerability)
            embedding_list = embedding.tolist() if isinstance(embedding, np.ndarray) else list(embedding)
            data = json.dumps(embedding_list).encode('utf-8')
            # 2. Encrypt
            encrypted_data = cls._get_cipher().encrypt(data)
            return encrypted_data
        except Exception as e:
            logger.critical(f"Encryption Failure: {e}")
            raise RuntimeError("Failed to encrypt biometric data")

    @classmethod
    def decrypt_embedding(cls, encrypted_data: bytes) -> np.ndarray:
        """
        Decrypts bytes back to numpy embedding vector.
        ONLY happens in Volatile Memory.
        """
        if encrypted_data is None:
            return None

        try:
            # 1. Decrypt
            decrypted_data = cls._get_cipher().decrypt(encrypted_data)
            # 2. Deserialize securely from JSON
            embedding_list = json.loads(decrypted_data.decode('utf-8'))
            embedding = np.array(embedding_list, dtype=np.float32)
            return embedding
        except Exception as e:
            logger.critical(f"Decryption Failure: {e}")
            AuditLogger.log_event("DECRYPTION_FAIL", "CRYPTO", "FAILURE", {"error": str(e)})
            raise RuntimeError("Failed to decrypt biometric data. Key mismatch or corruption.")
