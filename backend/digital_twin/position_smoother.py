
import numpy as np
from collections import deque
import time

class PositionSmoother:
    def __init__(self, history_size: int = 5, max_speed_mps: float = 2.0):
        self.history = deque(maxlen=history_size)
        self.max_speed = max_speed_mps
        self.last_valid_pos = None
        self.last_timestamp = 0.0

    def process(self, new_pos: np.ndarray) -> np.ndarray:
        now = time.time()
        
        if self.last_valid_pos is None:
            self.last_valid_pos = new_pos
            self.last_timestamp = now
            self.history.append(new_pos)
            return new_pos

        # 1. Velocity Check
        dt = now - self.last_timestamp
        if dt > 0:
            dist = np.linalg.norm(new_pos - self.last_valid_pos)
            speed = dist / dt
            
            # If speed exceeds human limit, clamp or reject
            # Here we clamp position to max possible distance
            if speed > self.max_speed:
                # Calculate max valid displacement
                max_dist = self.max_speed * dt
                direction = (new_pos - self.last_valid_pos) / dist
                new_pos = self.last_valid_pos + (direction * max_dist)

        # 2. Moving Average Smoothing
        self.history.append(new_pos)
        avg_pos = np.mean(np.array(self.history), axis=0)
        
        self.last_valid_pos = avg_pos
        self.last_timestamp = now
        
        return avg_pos
