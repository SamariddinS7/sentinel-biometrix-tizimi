
import json
import threading
import logging
import os
from .config import settings, DynamicSystemConfig
from .audit_logger import AuditLogger

logger = logging.getLogger("ConfigManager")

class ConfigManager:
    """
    Singleton Manager for Runtime AI Configuration.
    Handles Hot-Reloading, Persistence, and Validation.
    """
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(ConfigManager, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        self.config_lock = threading.RLock() # Reentrant lock for safe reads/writes
        self.config = DynamicSystemConfig() # Load defaults initially
        self.load_config()
        self._initialized = True

    def load_config(self):
        """Loads config from JSON file if exists, otherwise uses defaults."""
        file_path = settings.DYNAMIC_CONFIG_FILE
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    # Pydantic validation happens here
                    with self.config_lock:
                        self.config = DynamicSystemConfig(**data)
                logger.info("Dynamic configuration loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load dynamic config, using defaults: {e}")
                # Fallback to defaults is automatic via __init__

    def save_config(self):
        """Persists current config to JSON."""
        file_path = settings.DYNAMIC_CONFIG_FILE
        try:
            with self.config_lock:
                data = self.config.dict()
            
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=4)
            logger.info("Dynamic configuration saved.")
        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")

    def update_config(self, new_settings: dict, user_id: str = "SYSTEM"):
        """
        Updates configuration at runtime.
        Triggers audit logs and validation.
        """
        with self.config_lock:
            try:
                # Merge logic: We need to respect the nested structure
                # In a real app, we might use a recursive merge.
                # Here, we assume new_settings matches the Pydantic schema structure
                
                updated_config = DynamicSystemConfig(**new_settings)
                self.config = updated_config
                self.save_config()
                
                # Log the change
                AuditLogger.log_event(
                    "CONFIG_UPDATE", 
                    "CONFIG_MANAGER", 
                    "SUCCESS", 
                    {"user": user_id, "changes": "full_update"}, 
                    user_id
                )
                logger.info(f"Configuration updated by {user_id}")
                return True
            except Exception as e:
                logger.error(f"Invalid configuration update attempted: {e}")
                return False

    # --- Type-Safe Getters (Hot-Path Optimized) ---

    @property
    def general(self): return self.config.general
    @property
    def detection(self): return self.config.detection
    @property
    def recognition(self): return self.config.recognition
    @property
    def tracking(self): return self.config.tracking
    @property
    def liveness(self): return self.config.liveness
    @property
    def timeline(self): return self.config.timeline
    @property
    def heatmap(self): return self.config.heatmap
    @property
    def quality(self): return self.config.quality
    @property
    def alerts(self): return self.config.alerts
    @property
    def webhook(self): return self.config.webhook
    @property
    def snapshot(self): return self.config.snapshot
    @property
    def attendance(self): return self.config.attendance
    @property
    def security(self): return self.config.security
    @property
    def performance(self): return self.config.performance
    @property
    def logging(self): return self.config.logging
    @property
    def backup(self): return self.config.backup

# Global Instance
config_manager = ConfigManager()
