
import cv2
import time
import threading
import logging
from dataclasses import dataclass
from .config import settings
from .frame_queue import SmartFrameQueue
from .audit_logger import AuditLogger

logger = logging.getLogger("FrameGrabber")

@dataclass
class Frame:
    """Immutable Frame Object passed between threads"""
    id: int
    timestamp: float
    data: any # numpy array

class FrameGrabber(threading.Thread):
    """
    Producer Thread: Reads from Camera -> Pushes to SmartFrameQueue.
    """
    
    def __init__(self, source: str, frame_queue: SmartFrameQueue, camera_id: str):
        super().__init__(name=f"Grabber-{camera_id}")
        self.source = source
        self.queue = frame_queue
        self.camera_id = camera_id
        self.stop_event = threading.Event()
        self.fps_limit = 30
        self.frame_count = 0
        self.reconnect_interval = settings.CAMERA_RECONNECT_INTERVAL
        
        try:
            self.source_idx = int(source)
        except ValueError:
            self.source_idx = source

    def run(self):
        logger.info(f"[{self.camera_id}] Starting FrameGrabber thread.")
        AuditLogger.log_event("CAMERA_START", "FRAME_GRABBER", "SUCCESS", {"camera_id": self.camera_id})
        
        while not self.stop_event.is_set():
            cap = cv2.VideoCapture(self.source_idx)
            
            if not cap.isOpened():
                logger.error(f"[{self.camera_id}] Failed to open camera. Retrying...")
                AuditLogger.log_event("CAMERA_CONNECT_FAIL", "FRAME_GRABBER", "FAILURE", {"camera_id": self.camera_id})
                time.sleep(self.reconnect_interval)
                continue
            
            # Read Loop
            while not self.stop_event.is_set() and cap.isOpened():
                start_time = time.time()
                
                ret, frame_img = cap.read()
                
                if not ret:
                    logger.warning(f"[{self.camera_id}] Stream ended/error.")
                    break 
                
                self.frame_count += 1
                frame_obj = Frame(
                    id=self.frame_count,
                    timestamp=time.time(),
                    data=frame_img
                )
                
                # Push to Smart Queue (Handles Drops internally)
                self.queue.put(frame_obj)
                
                # FPS Throttling
                elapsed = time.time() - start_time
                wait = max(0.001, (1.0 / self.fps_limit) - elapsed)
                time.sleep(wait)

            cap.release()
            logger.info(f"[{self.camera_id}] Reconnecting...")
            
        logger.info(f"[{self.camera_id}] FrameGrabber stopped.")
        AuditLogger.log_event("CAMERA_STOP", "FRAME_GRABBER", "SUCCESS", {"camera_id": self.camera_id})

    def stop(self):
        self.stop_event.set()
