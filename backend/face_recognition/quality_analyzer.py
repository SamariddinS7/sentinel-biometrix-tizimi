
import cv2
import numpy as np
import logging
from .config_manager import config_manager

logger = logging.getLogger("QualityAnalyzer")

class QualityAnalyzer:
    """
    Analyzes face crops for environmental quality factors.
    - Blur (Laplacian Variance)
    - Lighting (Luminance Analysis)
    """

    @staticmethod
    def analyze(frame: np.ndarray, bbox: np.ndarray) -> dict:
        """
        Returns normalized scores (0.0 - 1.0) where 1.0 is optimal.
        """
        if frame is None or bbox is None:
            return {"blur": 0.0, "lighting": 0.0, "quality": 0.0}

        try:
            x1, y1, x2, y2 = map(int, bbox[:4])
            
            # Boundary checks
            h, w = frame.shape[:2]
            x1 = max(0, x1); y1 = max(0, y1)
            x2 = min(w, x2); y2 = min(h, y2)
            
            if x2 <= x1 or y2 <= y1:
                 return {"blur": 0.0, "lighting": 0.0, "quality": 0.0}

            face_crop = frame[y1:y2, x1:x2]
            gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)

            # 1. Blur Detection (Laplacian Variance)
            # Higher variance = sharper image
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            blur_threshold = config_manager.quality.blur_threshold
            # Normalize: 0 (Very Blur) -> 1 (Sharp). Cap at 2x threshold
            blur_score = min(1.0, laplacian_var / (blur_threshold * 2))

            # 2. Lighting Detection (Mean Intensity)
            mean_intensity = np.mean(gray)
            low_thresh = config_manager.quality.low_light_threshold
            high_thresh = config_manager.quality.over_exposure_threshold
            
            # Normalize Lighting: 1.0 is mid-range (optimal), 0.0 is too dark or too bright
            if mean_intensity < low_thresh:
                # Underexposed
                lighting_score = mean_intensity / low_thresh
            elif mean_intensity > high_thresh:
                # Overexposed
                lighting_score = 1.0 - ((mean_intensity - high_thresh) / (255 - high_thresh))
            else:
                lighting_score = 1.0
            
            lighting_score = max(0.0, min(1.0, lighting_score))

            # 3. Aggregate Quality
            # Weighted average
            total_quality = (0.6 * blur_score) + (0.4 * lighting_score)

            return {
                "blur_score": round(blur_score, 2),
                "lighting_score": round(lighting_score, 2),
                "total_quality": round(total_quality, 2)
            }

        except Exception as e:
            logger.error(f"Quality Analysis failed: {e}")
            return {"blur_score": 0.0, "lighting_score": 0.0, "total_quality": 0.0}
