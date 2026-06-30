
import cv2
import numpy as np
from ..config_manager import config_manager

class SnapshotProcessor:
    """
    Enforces Privacy Rules on Raw Images.
    1. Crop to ROI
    2. Downscale (Low Res)
    3. Anonymize (Blur)
    4. Encode (Strip Metadata)
    """

    @staticmethod
    def process(frame: np.ndarray, bbox: np.ndarray) -> bytes:
        if frame is None or bbox is None:
            return None

        conf = config_manager.snapshot
        if not conf.enabled:
            return None

        try:
            h, w = frame.shape[:2]
            x1, y1, x2, y2 = map(int, bbox[:4])
            
            # 1. Add Margin (Context)
            margin = int((x2 - x1) * 0.2)
            x1 = max(0, x1 - margin)
            y1 = max(0, y1 - margin)
            x2 = min(w, x2 + margin)
            y2 = min(h, y2 + margin)

            crop = frame[y1:y2, x1:x2]
            if crop.size == 0: return None

            # 2. Downscale (Privacy Rule: No High Res)
            # Maintain aspect ratio, max dimension = conf.resolution
            ch, cw = crop.shape[:2]
            scale = conf.resolution / max(ch, cw)
            new_w = int(cw * scale)
            new_h = int(ch * scale)
            resized = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_AREA)

            # 3. Anonymize (Privacy Rule: Blur Features)
            # Gaussian Blur with configurable sigma
            ksize = (conf.blur_radius * 2) + 1 # Must be odd
            blurred = cv2.GaussianBlur(resized, (ksize, ksize), 0)

            # 4. Encode to WebP (Efficient, Metadata Stripped by default in cv2 encode)
            success, encoded_img = cv2.imencode('.webp', blurred, [cv2.IMWRITE_WEBP_QUALITY, 80])
            
            if success:
                return encoded_img.tobytes()
            return None

        except Exception:
            return None
