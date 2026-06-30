
import queue
import logging
from typing import Optional, Any
from .config import settings

logger = logging.getLogger("SmartQueue")

class SmartFrameQueue:
    """
    Thread-Safe, Bounded Queue with DROP_OLDEST Policy.
    
    This is critical for real-time systems. If the AI is too slow,
    we must drop the *old* frames so that when the AI *is* ready,
    it processes the *latest* available frame (Minimum Latency).
    """
    
    def __init__(self, maxsize: int = 3):
        self._queue = queue.Queue(maxsize=maxsize)
        self.drop_count = 0

    def put(self, item: Any):
        """
        Non-blocking put. If full, drop oldest item then insert new.
        """
        try:
            self._queue.put_nowait(item)
        except queue.Full:
            # Queue is full, enforce Drop-Old policy (Backpressure Handling)
            try:
                _ = self._queue.get_nowait() # Discard oldest
                self.drop_count += 1
                if self.drop_count % 50 == 0:
                     logger.warning(f"High Latency Warning: Dropped {self.drop_count} frames to maintain sync.")
                
                self._queue.put_nowait(item) # Insert new
            except queue.Empty:
                pass # Race condition, handled gracefully

    def get(self, timeout: Optional[float] = None) -> Any:
        return self._queue.get(timeout=timeout)
    
    def qsize(self) -> int:
        return self._queue.qsize()

    def empty(self) -> bool:
        return self._queue.empty()
