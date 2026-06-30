
import numpy as np
from dataclasses import dataclass

@dataclass
class GridCell:
    count: int = 0
    avg_confidence: float = 0.0
    avg_lighting: float = 0.0
    avg_quality: float = 0.0

class SpatialGrid:
    """
    2D Grid managing spatial metrics accumulation.
    Uses Exponential Moving Average (EMA) for temporal smoothing.
    """
    def __init__(self, rows: int, cols: int, ema_alpha: float):
        self.rows = rows
        self.cols = cols
        self.alpha = ema_alpha
        # Initialize grid as list of lists of GridCell
        self.cells = [[GridCell() for _ in range(cols)] for _ in range(rows)]

    def update_cell(self, r: int, c: int, confidence: float, quality: float, lighting: float):
        """
        Update a specific cell with new observation data.
        """
        if r < 0 or r >= self.rows or c < 0 or c >= self.cols:
            return

        cell = self.cells[r][c]
        cell.count += 1
        
        # Exponential Moving Average Update
        # New_Avg = alpha * New_Val + (1 - alpha) * Old_Avg
        if cell.count == 1:
            # First sample initialization
            cell.avg_confidence = confidence
            cell.avg_lighting = lighting
            cell.avg_quality = quality
        else:
            cell.avg_confidence = (self.alpha * confidence) + ((1 - self.alpha) * cell.avg_confidence)
            cell.avg_lighting = (self.alpha * lighting) + ((1 - self.alpha) * cell.avg_lighting)
            cell.avg_quality = (self.alpha * quality) + ((1 - self.alpha) * cell.avg_quality)

    def get_grid_data(self, min_samples: int):
        """
        Export grid as simple primitive arrays for JSON serialization.
        Returns: 2D array of { conf, qual, light } or None if insufficient samples.
        """
        result = []
        for r in range(self.rows):
            row_data = []
            for c in range(self.cols):
                cell = self.cells[r][c]
                if cell.count >= min_samples:
                    row_data.append({
                        "val": round(cell.avg_confidence, 2),
                        "lit": round(cell.avg_lighting, 2),
                        "qual": round(cell.avg_quality, 2)
                    })
                else:
                    row_data.append(None) # Represents "No Data"
            result.append(row_data)
        return result
