
import os
from pydantic import BaseSettings, Field

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
    ENCRYPTION_KEY: str = Field(..., env="BIOMETRIC_ENCRYPTION_KEY") 
    STORAGE_PATH: str = "./secure_storage/embeddings.bin"
    
    # --- Performance ---
    FRAME_QUEUE_SIZE: int = 30

    class Config:
        env_file = ".env"

settings = FaceRecognitionConfig()
