
import logging
import json
from datetime import datetime
from .config import settings

# Configure specific logger for audit trail
audit_logger = logging.getLogger("SentinelAudit")
audit_logger.setLevel(logging.INFO)
file_handler = logging.FileHandler(settings.AUDIT_LOG_FILE)
formatter = logging.Formatter('%(message)s') # JSON only
file_handler.setFormatter(formatter)
audit_logger.addHandler(file_handler)

class AuditLogger:
    """
    Compliance Logging System.
    Logs all security-critical events (Access, Identification, Errors).
    """

    @staticmethod
    def log_event(event_type: str, module: str, status: str, details: dict = None, user_id: str = "SYSTEM"):
        if not settings.AUDIT_LOG_ENABLED:
            return

        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "module": module,
            "status": status,
            "user_id": user_id,
            "details": details or {},
            "environment": settings.APP_NAME
        }
        
        # Log as single-line JSON for easy parsing (ELK/Splunk ready)
        audit_logger.info(json.dumps(entry))
        
        # Also print critical failures to std out
        if status == "FAILURE":
            logging.error(f"AUDIT FAILURE [{module}]: {event_type}")

    @staticmethod
    def log_access(camera_id: str, track_id: int, identity: str, confidence: float):
        AuditLogger.log_event(
            event_type="BIOMETRIC_ACCESS",
            module="RECOGNITION",
            status="SUCCESS" if identity != "UNKNOWN" else "WARNING",
            details={
                "camera_id": camera_id,
                "track_id": track_id,
                "identity": identity,
                "confidence": round(confidence, 4)
            }
        )
