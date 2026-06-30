
import cv2
import numpy as np
from insightface.utils import face_align

class FaceAligner:
    """
    Standard 5-point landmark alignment.
    """
    @staticmethod
    def align(img: np.ndarray, kps: np.ndarray) -> np.ndarray:
        """
        Crops and aligns the face based on 5 landmarks (eyes, nose, mouth).
        Output is 112x112 for ArcFace r100.
        """
        # norm_crop executes the affine transformation using standard reference points
        aimg = face_align.norm_crop(img, landmark=kps)
        return aimg
