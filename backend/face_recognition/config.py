
import os
from pydantic import BaseSettings, BaseModel, Field

class GeneralConfig(BaseModel):
    work_start: str = "09:00"
    work_end: str = "17:00"

class DetectionConfig(BaseModel):
    confidence_threshold: float = 0.5
    min_face_size: int = 40
    max_faces: int = 10

class RecognitionConfig(BaseModel):
    reidentification_interval: float = 2.0
    known_threshold: float = 0.40

class TrackingConfig(BaseModel):
    max_age: int = 30

class LivenessConfig(BaseModel):
    enabled: bool = True

class TimelineConfig(BaseModel):
    merge_gap_seconds: int = 300
    exit_timeout_seconds: int = 60

class HeatmapConfig(BaseModel):
    enabled: bool = True
    update_interval_frames: int = 5

class QualityConfig(BaseModel):
    blur_threshold: float = 100.0
    low_light_threshold: float = 30.0
    over_exposure_threshold: float = 220.0

class AlertsConfig(BaseModel):
    enabled: bool = True

class WebhookConfig(BaseModel):
    enabled: bool = True

class SnapshotConfig(BaseModel):
    enabled: bool = True

class AttendanceConfig(BaseModel):
    enabled: bool = True

class SecurityConfig(BaseModel):
    data_retention_days: int = 30
    allow_forget_person: bool = True

class PerformanceConfig(BaseModel):
    ai_worker_fps: float = 15.0
    ai_worker_pool_size: int = 4

class LoggingConfig(BaseModel):
    level: str = "INFO"

class BackupConfig(BaseModel):
    enabled: bool = True

class DynamicSystemConfig(BaseModel):
    general: GeneralConfig = Field(default_factory=GeneralConfig)
    detection: DetectionConfig = Field(default_factory=DetectionConfig)
    recognition: RecognitionConfig = Field(default_factory=RecognitionConfig)
    tracking: TrackingConfig = Field(default_factory=TrackingConfig)
    liveness: LivenessConfig = Field(default_factory=LivenessConfig)
    timeline: TimelineConfig = Field(default_factory=TimelineConfig)
    heatmap: HeatmapConfig = Field(default_factory=HeatmapConfig)
    quality: QualityConfig = Field(default_factory=QualityConfig)
    alerts: AlertsConfig = Field(default_factory=AlertsConfig)
    webhook: WebhookConfig = Field(default_factory=WebhookConfig)
    snapshot: SnapshotConfig = Field(default_factory=SnapshotConfig)
    attendance: AttendanceConfig = Field(default_factory=AttendanceConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    performance: PerformanceConfig = Field(default_factory=PerformanceConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    backup: BackupConfig = Field(default_factory=BackupConfig)

class FaceRecognitionConfig(BaseSettings):
    # --- Hardware & System ---
    GPU_ID: int = 0
    USE_FP16: bool = True
    
    # --- Models ---
    MODEL_NAME: str = "buffalo_l" 
    ROOT_DIR: str = os.path.expanduser("~/.insightface")
    
    # --- Detection ---
    DET_THRESHOLD: float = 0.5
    DET_INPUT_SIZE: tuple = (640, 640)
    
    # --- Recognition ---
    REC_THRESHOLD: float = 0.40
    REC_BATCH_SIZE: int = 1
    
    # --- Tracking ---
    TRACK_BUFFER: int = 30
    
    # --- Identity Management ---
    REID_INTERVAL: float = 2.0
    
    # --- Attendance & Zones ---
    ENTRY_ZONES: list = ["Z-ENT", "CAM-01"]
    EXIT_ZONES: list = ["Z-EXIT", "Z-PARKING"]
    
    # --- Security ---
    ENCRYPTION_KEY: str = Field(env="BIOMETRIC_ENCRYPTION_KEY") 
    STORAGE_PATH: str = "./secure_storage/embeddings.bin"
    
    # --- Performance ---
    FRAME_QUEUE_SIZE: int = 30
    DYNAMIC_CONFIG_FILE: str = "./secure_storage/dynamic_config.json"

    class Config:
        env_file = ".env"

settings = FaceRecognitionConfig()

