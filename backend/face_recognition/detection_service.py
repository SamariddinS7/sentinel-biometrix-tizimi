
import numpy as np
import logging
from typing import List, Tuple
from .insightface_manager import InsightFaceManager
from .config_manager import config_manager
from insightface.app.common import Face

logger = logging.getLogger("DetectionService")

class DetectionService:
    def __init__(self):
        self.manager = InsightFaceManager()

    def process_frame(self, frame: np.ndarray) -> List[Face]:
        """
        Executes RetinaFace Detection ONLY.
        Returns: List of Face objects containing ONLY bbox, kps (landmarks), and score.
        Does NOT perform embedding (saving ~200ms per face).
        """
        if frame is None or frame.size == 0:
            return []

        det_model = self.manager.get_det_model()
        conf = config_manager.detection
        
        try:
            # 1. Pure Detection (Returns bboxes + landmarks)
            # max_num=0 implies no limit during inference (we filter later)
            bboxes, kps = det_model.detect(frame, max_num=0, metric='default')
            
            if bboxes.shape[0] == 0:
                return []

            valid_faces = []
            
            for i in range(bboxes.shape[0]):
                bbox = bboxes[i, 0:4]
                det_score = bboxes[i, 4]
                landmarks = kps[i]

                # 2. Dynamic Confidence Threshold
                # Modified for ByteTrack: Allow low-confidence detections to pass through.
                # The Tracker will separate High/Low confidence and handle association.
                # 0.1 is a safe floor to reject pure noise while keeping difficult faces.
                if det_score < 0.1:
                    continue
                    
                # 3. Dynamic Size Filtering
                width = bbox[2] - bbox[0]
                height = bbox[3] - bbox[1]
                if width < conf.min_face_size or height < conf.min_face_size:
                    continue

                # Create lightweight Face object for Tracking
                face = Face(bbox=bbox, kps=landmarks, det_score=det_score)
                valid_faces.append(face)
            
            # 4. Dynamic Max Faces Limit
            # We sort by area to prioritize larger faces if we hit the limit, 
            # though usually limits are high enough.
            valid_faces.sort(key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]), reverse=True)
            return valid_faces[:conf.max_faces * 2] # Allow extra buffer for tracker to filter

        except Exception as e:
            logger.error(f"Detection pipeline error: {e}")
            return []
