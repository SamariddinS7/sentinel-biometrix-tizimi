"""Snapshot manager for HikVisionManager."""

import cv2
import datetime
from pathlib import Path
from typing import Optional
from PySide6.QtCore import QObject, Signal


class SnapshotManager(QObject):
    """Handles saving snapshots from camera frames."""
    
    snapshot_saved = Signal(str, str)
    snapshot_error = Signal(str, str)
    
    def __init__(self, storage_path: Path):
        super().__init__()
        self.storage_path = storage_path
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
    def save_snapshot(self, camera_name: str, frame) -> Optional[str]:
        """Save current frame as JPG snapshot."""
        try:
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            filename = f"{timestamp}.jpg"
            filepath = self.storage_path / filename
            
            success = cv2.imwrite(str(filepath), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            
            if success:
                self.snapshot_saved.emit(camera_name, str(filepath))
                return str(filepath)
            else:
                raise RuntimeError("Failed to write image file")
                
        except Exception as e:
            self.snapshot_error.emit(camera_name, str(e))
            return None