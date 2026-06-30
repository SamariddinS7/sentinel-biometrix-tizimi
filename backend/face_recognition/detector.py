
import numpy as np
import cv2
from .insightface_manager import manager
from .config import settings
from insightface.app.common import Face

class FaceDetector:
    def __init__(self):
        self.det_model = manager.get_det_model()

    def detect(self, img: np.ndarray):
        """
        Run RetinaFace detection.
        Returns list of Face objects (bbox, kps, det_score).
        """
        # input_size is handled during app.prepare in manager
        bboxes, kps = self.det_model.detect(img, max_num=0, metric='default')
        
        if bboxes.shape[0] == 0:
            return []

        faces = []
        for i in range(bboxes.shape[0]):
            bbox = bboxes[i, 0:4]
            det_score = bboxes[i, 4]
            
            if det_score < settings.DET_THRESHOLD:
                continue
                
            kps_ = None
            if kps is not None:
                kps_ = kps[i]
            
            face = Face(bbox=bbox, kps=kps_, det_score=det_score)
            faces.append(face)
            
        return faces
