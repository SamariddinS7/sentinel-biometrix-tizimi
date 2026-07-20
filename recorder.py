"""Video recording engine for HikVisionManager."""

import cv2
import queue
import threading
import datetime
import os
from pathlib import Path
from typing import Optional
from PySide6.QtCore import QObject, Signal, QThread


class Recorder(QObject):
    """Handles video recording in a separate thread."""
    
    recording_started = Signal(str)
    recording_stopped = Signal(str)
    recording_error = Signal(str, str)
    frame_dropped = Signal(str)
    
    def __init__(self, camera_name: str, storage_path: Path):
        super().__init__()
        self.camera_name = camera_name
        self.storage_path = storage_path / camera_name
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        self._frame_queue: queue.Queue = queue.Queue(maxsize=60)
        self._recording = False
        self._writer: Optional[cv2.VideoWriter] = None
        self._thread: Optional[threading.Thread] = None
        self._fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        
    def start_recording(self) -> bool:
        """Start recording thread."""
        if self._recording:
            return False
            
        self._recording = True
        self._thread = threading.Thread(target=self._record_loop, daemon=True)
        self._thread.start()
        self.recording_started.emit(self.camera_name)
        return True
        
    def stop_recording(self):
        """Stop recording and save file."""
        if not self._recording:
            return
            
        self._recording = False
        if self._thread:
            self._thread.join(timeout=5)
            
        self._finalize_writer()
        self.recording_stopped.emit(self.camera_name)
        
    def write_frame(self, frame) -> bool:
        """Add frame to recording queue."""
        if not self._recording:
            return False
            
        try:
            self._frame_queue.put_nowait(frame.copy())
            return True
        except queue.Full:
            self.frame_dropped.emit(self.camera_name)
            return False
            
    def _record_loop(self):
        """Main recording loop running in thread."""
        while self._recording:
            try:
                frame = self._frame_queue.get(timeout=1)
                
                if self._writer is None:
                    self._initialize_writer(frame)
                    
                if self._writer is not None:
                    self._writer.write(frame)
                    
            except queue.Empty:
                continue
            except Exception as e:
                self.recording_error.emit(self.camera_name, str(e))
                break
                
        self._finalize_writer()
        
    def _initialize_writer(self, frame):
        """Initialize VideoWriter with first frame dimensions."""
        try:
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            filename = f"{timestamp}.mp4"
            filepath = self.storage_path / filename
            
            height, width = frame.shape[:2]
            self._writer = cv2.VideoWriter(
                str(filepath),
                self._fourcc,
                25.0,
                (width, height)
            )
            
            if not self._writer.isOpened():
                raise RuntimeError(f"Failed to create {filepath}")
                
        except Exception as e:
            self.recording_error.emit(self.camera_name, str(e))
            
    def _finalize_writer(self):
        """Release VideoWriter and check disk space."""
        if self._writer is not None:
            self._writer.release()
            self._writer = None
            
    def is_recording(self) -> bool:
        return self._recording