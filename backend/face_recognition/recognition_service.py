
import queue
import threading
import time
import logging
import cv2
import numpy as np
from typing import Dict, List

# Core Components
from .detector import FaceDetector
from .aligner import FaceAligner
from .embedder import FaceEmbedder
from .matcher import FaceMatcher
from .embedding_store import EmbeddingStore
from .identity_manager import IdentityManager
from .tracker import Tracker  # Provided ByteTrack implementation
from .config import settings

logger = logging.getLogger(__name__)

class RecognitionService:
    def __init__(self):
        # 1. Initialize Components
        self.detector = FaceDetector()
        self.aligner = FaceAligner()
        self.embedder = FaceEmbedder()
        self.store = EmbeddingStore()
        
        # Tracker (ByteTrack)
        self.tracker = Tracker(frame_rate=30)
        
        # Identity Cache
        self.identity_manager = IdentityManager(reid_interval=settings.REID_INTERVAL)
        
        # Async State
        self.frame_queue = queue.Queue(maxsize=settings.FRAME_QUEUE_SIZE)
        self.running = False
        self.db_snapshot = {}
        self.lock = threading.Lock()

    def start(self):
        self.running = True
        self.db_snapshot = self.store.get_all() # Initial DB load
        self.worker_thread = threading.Thread(target=self._process_loop, daemon=True)
        self.worker_thread.start()
        logger.info("Recognition Service Started (Async)")

    def stop(self):
        self.running = False
        if hasattr(self, 'worker_thread'):
            self.worker_thread.join()

    def push_frame(self, frame: np.ndarray, frame_id: int):
        if not self.frame_queue.full():
            self.frame_queue.put((frame, frame_id))
        else:
            # Drop oldest strategy for real-time compliance
            try:
                self.frame_queue.get_nowait()
                self.frame_queue.put((frame, frame_id))
            except queue.Empty:
                pass

    def _process_loop(self):
        while self.running:
            try:
                frame, frame_id = self.frame_queue.get(timeout=1.0)
                self._process_frame(frame)
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Error in recognition loop: {e}", exc_info=True)

    def _process_frame(self, frame: np.ndarray):
        # 1. Detect (RetinaFace)
        # Returns list of Face objects (bbox, kps, score)
        raw_detections = self.detector.detect(frame)
        
        # 2. Track (ByteTrack)
        # Associates detections across frames
        active_tracks = self.tracker.update(raw_detections, frame.shape[:2])
        
        # 3. Clean Identity Cache (remove lost tracks)
        active_ids = {t.track_id for t in active_tracks}
        self.identity_manager.clean_stale(active_ids)

        final_results = []

        for track in active_tracks:
            track_id = track.track_id
            bbox = track.bbox
            
            # Default State
            person_id = "Detecting..."
            confidence = 0.0
            
            # 4. Check Identity Cache
            if self.identity_manager.should_process(track_id):
                # Need Recognition: Flow -> Align -> Embed -> Match
                
                # Check if track has landmarks (InsightFace tracker might not preserve them perfectly, 
                # but our custom STrack in tracker.py stores detection_obj)
                if hasattr(track, 'detection_obj') and track.detection_obj is not None:
                    kps = track.detection_obj.kps
                    
                    # Align
                    aligned = self.aligner.align(frame, kps)
                    
                    # Embed
                    embedding = self.embedder.get_embedding(aligned)
                    
                    # Match
                    with self.lock:
                        # Thread-safe read of DB
                        person_id, confidence = FaceMatcher.match_one_to_many(embedding, self.db_snapshot)
                    
                    # Update Cache
                    self.identity_manager.update_identity(track_id, person_id, confidence)
                else:
                    # Fallback if no kps (should rarely happen with ByteTrack+RetinaFace)
                    pass
            
            # 5. Retrieve from Cache
            cached_id = self.identity_manager.get_identity(track_id)
            if cached_id:
                person_id = cached_id.person_id
                confidence = cached_id.confidence

            final_results.append({
                "track_id": track_id,
                "bbox": [int(b) for b in bbox],
                "identity": person_id,
                "score": float(confidence)
            })

        # Hook for external consumption (e.g., WebSocket broadcaster)
        # self.on_result(final_results) 
        # logger.debug(f"Frame Processed: {len(final_results)} tracks")

    def register_face(self, img: np.ndarray, person_id: str) -> bool:
        """
        API method to register a new user from a raw image.
        """
        faces = self.detector.detect(img)
        if len(faces) != 1:
            logger.warning("Registration failed: Image must contain exactly one face.")
            return False
            
        face = faces[0]
        aligned = self.aligner.align(img, face.kps)
        embedding = self.embedder.get_embedding(aligned)
        
        with self.lock:
            self.store.add_identity(person_id, embedding)
            self.db_snapshot = self.store.get_all() # Refresh snapshot
            
        return True
