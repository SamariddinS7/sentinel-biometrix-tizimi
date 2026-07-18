
import threading
import logging
import insightface
from insightface.app import FaceAnalysis
from .config import settings

logger = logging.getLogger(__name__)

class InsightFaceManager:
    """
    Singleton class to manage ONNX Runtime sessions.
    Ensures models are loaded only once and are thread-safe.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(InsightFaceManager, cls).__new__(cls)
                    cls._instance.app = None
                    cls._instance.det_model = None
                    cls._instance.rec_model = None
                    cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        try:
            logger.info(f"Loading InsightFace model: {settings.MODEL_NAME}...")
            
            # Prioritize CUDA, fallback to CPU
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
            
            self.app = FaceAnalysis(
                name=settings.MODEL_NAME, 
                root=settings.ROOT_DIR,
                providers=providers,
                allowed_modules=['detection', 'recognition']
            )
            
            # Initialize with specific input size for optimization
            self.app.prepare(ctx_id=settings.GPU_ID, det_size=settings.DET_INPUT_SIZE)
            
            # Direct access to models for granular pipeline control
            self.det_model = self.app.det_model
            self.rec_model = self.app.models.get('recognition')
            
            if not self.det_model or not self.rec_model:
                raise RuntimeError("Failed to load specific detection or recognition modules.")

            logger.info("InsightFace models loaded successfully.")
        except Exception as e:
            logger.critical(f"Failed to load InsightFace models: {e}")
            raise RuntimeError("Model initialization failed")

    def get_det_model(self):
        return self.det_model

    def get_rec_model(self):
        return self.rec_model

# Global access point
manager = InsightFaceManager()
