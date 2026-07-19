
import threading
import logging
from typing import Dict, List
from ..config_manager import config_manager
from .spatial_grid import SpatialGrid

logger = logging.getLogger("HeatmapService")

class HeatmapService:
    """
    Central Service for collecting spatial confidence metrics per camera.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(HeatmapService, cls).__new__(cls)
                    cls._instance._grids: Dict[str, SpatialGrid] = {}
                    cls._instance.service_lock = threading.RLock()
        return cls._instance

    def _get_or_create_grid(self, camera_id: str) -> SpatialGrid:
        conf = config_manager.heatmap
        with self.service_lock:
            if camera_id not in self._grids:
                self._grids[camera_id] = SpatialGrid(conf.grid_rows, conf.grid_cols, conf.ema_alpha)
            return self._grids[camera_id]

    def update(self, camera_id: str, frame_shape: tuple, detections: List[dict]):
        """
        Ingest a batch of detections for a frame.
        detections: List of dicts { 'bbox': [x,y,w,h], 'conf': float, 'quality': dict }
        """
        if not config_manager.heatmap.enabled:
            return

        grid = self._get_or_create_grid(camera_id)
        h, w = frame_shape[:2]
        
        # Grid dimensions
        rows = grid.rows
        cols = grid.cols
        
        for det in detections:
            # Calculate center of face
            bbox = det['bbox'] # [x, y, w, h]
            cx = bbox[0] + (bbox[2] / 2)
            cy = bbox[1] + (bbox[3] / 2)
            
            # Map to grid coordinates
            # prevent out of bounds with min/max
            c_idx = int((cx / w) * cols)
            r_idx = int((cy / h) * rows)
            
            c_idx = max(0, min(c_idx, cols - 1))
            r_idx = max(0, min(r_idx, rows - 1))
            
            # Extract metrics
            conf_score = det.get('conf', 0.0)
            qual_score = det.get('quality', {}).get('total_quality', 0.5)
            lit_score = det.get('quality', {}).get('lighting_score', 0.5)
            
            grid.update_cell(r_idx, c_idx, conf_score, qual_score, lit_score)

    def get_heatmap_snapshot(self, camera_id: str) -> dict:
        """
        Returns the current state of the heatmap for frontend rendering.
        Also generates optimization insights.
        """
        conf = config_manager.heatmap
        grid = self._get_or_create_grid(camera_id)
        
        raw_grid = grid.get_grid_data(conf.min_samples_per_cell)
        
        # Generate Insights based on aggregation
        insights = self._generate_insights(raw_grid)
        
        return {
            "camera_id": camera_id,
            "rows": grid.rows,
            "cols": grid.cols,
            "grid": raw_grid,
            "insights": insights
        }

    def _generate_insights(self, grid_data) -> List[str]:
        """
        Analyze grid statistics to provide actionable feedback.
        """
        insights = []
        if not grid_data: return insights

        # Flatten for analysis, ignoring None
        valid_cells = [c for row in grid_data for c in row if c is not None]
        if not valid_cells:
            insights.append("Insufficient data collected. Keep camera running.")
            return insights

        avg_conf = sum(c['val'] for c in valid_cells) / len(valid_cells)
        avg_lit = sum(c['lit'] for c in valid_cells) / len(valid_cells)

        if avg_conf < 0.5:
            insights.append("⚠️ General recognition confidence is LOW. Check camera focus.")
        
        if avg_lit < 0.4:
            insights.append("🌑 Scene appears UNDEREXPOSED. Improve lighting.")
        elif avg_lit > 0.85:
            insights.append("☀️ Scene appears OVEREXPOSED. Check for backlight.")

        return insights

heatmap_service = HeatmapService()
