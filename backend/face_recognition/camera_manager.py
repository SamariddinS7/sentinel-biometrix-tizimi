
import threading
import queue
import time
import logging
import base64
from typing import Dict, Optional
import numpy as np
import cv2

from .config import settings
from .config_manager import config_manager
from .frame_grabber import FrameGrabber, Frame
from .frame_queue import SmartFrameQueue
from .detection_service import DetectionService
from .recognition_service import recognition_service
from .tracker import Tracker, TrackState
from .person_registry import person_registry
from .audit_logger import AuditLogger
from .timeline_manager import timeline_manager
from .heatmap.heatmap_service import heatmap_service
from .quality_analyzer import QualityAnalyzer
from .snapshot.snapshot_service import snapshot_service
from ..digital_twin.person_3d_mapper import Person3DMapper
from ..security.zone_engine import zone_engine

logger = logging.getLogger("CameraManager")

class CameraPipeline:
    """
    Mandatory "Tracking-First" Pipeline.
    Strict Execution Order: Detect -> Track -> Recognize -> 3D Map -> Zone Security -> Timeline -> Heatmap -> Output
    """
    def __init__(self, camera_id: str, source: str, detection_service: DetectionService, optical_params: dict, mode: str = 'PULL'):
        self.camera_id = camera_id
        self.source = source
        self.mode = mode
        self.detection_service = detection_service
        self.frame_queue = SmartFrameQueue(maxsize=settings.FRAME_QUEUE_SIZE)
        self.output_callback = None 
        self.tracker = Tracker()
        
        # Initialize 3D Mapper
        self.person_mapper = Person3DMapper(camera_id, optical_params)
        self.floor_id = optical_params.get('floor_id', 'FLOOR-1') # Default floor
        
        self.grabber = None
        if mode == 'PULL':
            self.grabber = FrameGrabber(source, self.frame_queue, camera_id)
        
        self.worker_thread = None
        self.stop_event = threading.Event()
        self.frame_counter = 0

    def start(self):
        self.stop_event.clear()
        if self.grabber:
            self.grabber.start()
        self.worker_thread = threading.Thread(target=self._ai_worker_loop, name=f"AI-{self.camera_id}", daemon=True)
        self.worker_thread.start()
        logger.info(f"[{self.camera_id}] Pipeline STARTED.")

    def stop(self):
        self.stop_event.set()
        if self.grabber:
            self.grabber.stop()
            self.grabber.join(timeout=2.0)
        if self.worker_thread:
            self.worker_thread.join(timeout=2.0)

    def inject_frame(self, frame_bytes: bytes):
        try:
            nparr = np.frombuffer(frame_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is not None:
                self.frame_counter += 1
                self.frame_queue.put(Frame(id=self.frame_counter, timestamp=time.time(), data=img))
        except Exception:
            pass

    def set_output_callback(self, callback):
        self.output_callback = callback

    def _ai_worker_loop(self):
        while not self.stop_event.is_set():
            fps_conf = config_manager.performance.ai_worker_fps
            heatmap_conf = config_manager.heatmap
            start_time = time.time()
            
            try:
                frame: Frame = self.frame_queue.get(timeout=0.5)
            except queue.Empty:
                try:
                    timeline_manager.update(self.camera_id, [])
                except Exception:
                    pass
                continue

            try:
                # 1. DETECT
                raw_detections = self.detection_service.process_frame(frame.data)
                
                # 2. TRACK
                active_tracks = self.tracker.update(raw_detections, frame.data.shape[:2])
                
                # 3. PRUNE REGISTRY & MAPPER
                current_track_ids = [t.track_id for t in active_tracks]
                person_registry.prune(current_track_ids)
                self.person_mapper.cleanup(current_track_ids)

                pipeline_results = []
                timeline_updates = []
                heatmap_updates = [] 
                
                # Collect security alerts from this frame
                frame_security_alerts = []

                # 4. PROCESS TRACKS
                for track in active_tracks:
                    if not track.is_confirmed():
                        continue
                    
                    track_id = track.track_id
                    
                    # 5. RECOGNIZE (CONDITIONAL)
                    if person_registry.needs_recognition(track_id):
                        det_obj = track.detection_obj
                        if det_obj is not None and det_obj.kps is not None:
                            embedding = recognition_service.generate_embedding(frame.data, det_obj.kps)
                            known_faces = {} 
                            user_id, conf, status = recognition_service.match_face(embedding, known_faces)
                            person_registry.update_identity(track_id, user_id, conf, status)
                            
                            if status == "VERIFIED":
                                AuditLogger.log_access(self.camera_id, track_id, user_id, conf)

                    # 6. FETCH STATE
                    identity_data = person_registry.get_identity(track_id)
                    p_id = identity_data['user_id'] if identity_data['user_id'] else "UNKNOWN"
                    confidence = identity_data['confidence']
                    
                    # Identity dict for policy checks
                    id_dict = {
                        "user_id": p_id,
                        "role": "UNKNOWN" # In real app, fetch role from DB using p_id
                    }
                    if p_id == "Admin User": id_dict["role"] = "ADMIN" # Mock logic
                    
                    # 7. QUALITY ANALYSIS
                    quality_metrics = QualityAnalyzer.analyze(frame.data, track.bbox)

                    # 8. PRIVACY SNAPSHOT
                    if track.is_confirmed() and not track.snapshot_id:
                        snapshot_id = snapshot_service.capture(frame.data, track.bbox, track.track_id, self.camera_id)
                        track.snapshot_id = snapshot_id

                    # 9. 3D MAPPING (RAY CASTING)
                    pos_3d = self.person_mapper.calculate_3d_position(track_id, track.bbox)
                    
                    # 10. ZONE SECURITY CHECK (STRICT)
                    if pos_3d:
                        zone_alerts = zone_engine.process_position(track_id, id_dict, pos_3d, self.floor_id)
                        if zone_alerts:
                            frame_security_alerts.extend(zone_alerts)

                    timeline_updates.append({
                        "track_id": track_id,
                        "person_id": p_id,
                        "meta": {"conf": confidence, "snapshot": track.snapshot_id, "pos_3d": pos_3d}
                    })

                    heatmap_updates.append({
                        "bbox": track.bbox, 
                        "conf": confidence,
                        "quality": quality_metrics
                    })
                    
                    tl_data = timeline_manager.get_display_data(track_id)
                    
                    pipeline_results.append({
                        "trackId": track_id,
                        "bbox": {
                            "x": int(track.bbox[0]),
                            "y": int(track.bbox[1]),
                            "w": int(track.bbox[2] - track.bbox[0]),
                            "h": int(track.bbox[3] - track.bbox[1])
                        },
                        "identity": {"fullName": identity_data['user_id']} if identity_data['user_id'] != "UNKNOWN" else None,
                        "state": identity_data['status'],
                        "similarity": identity_data['confidence'],
                        "detectionScore": float(track.detection_obj.det_score) if track.detection_obj else 0.0,
                        "duration": tl_data.get("duration_sec", 0),
                        "timelineStatus": tl_data.get("status", "VISIBLE"),
                        "quality": quality_metrics,
                        "position3d": pos_3d
                    })

                # --- UPDATE SERVICES ---
                timeline_manager.update(self.camera_id, timeline_updates)
                heatmap_service.update(self.camera_id, frame.data.shape, heatmap_updates)

                # --- PROCESS ALERTS & ATTACH SNAPSHOTS ---
                # Merge Loitering Alerts (Timeline) with Zone Alerts (Security)
                timeline_alerts = timeline_manager.get_latest_alerts()
                all_alerts = timeline_alerts + frame_security_alerts
                
                enriched_alerts = []
                for alert in all_alerts:
                    # Find track snapshot
                    t_id_str = alert.get('entityId') or str(alert.get('track_id'))
                    snap_id = next((t['meta'].get('snapshot') for t in timeline_updates if str(t['track_id']) == t_id_str), None)
                    
                    if snap_id:
                        img_data = snapshot_service.get_snapshot(snap_id)
                        if img_data:
                            b64_img = base64.b64encode(img_data).decode('utf-8')
                            alert['snapshot'] = f"data:image/webp;base64,{b64_img}"
                    enriched_alerts.append(alert)

                # --- BUILD OUTPUT ---
                output_payload = {
                    "type": "result",
                    "timestamp": frame.timestamp,
                    "tracks": pipeline_results,
                    "alerts": enriched_alerts
                }
                
                if frame.id % heatmap_conf.update_interval_frames == 0:
                    heatmap_data = heatmap_service.get_heatmap_snapshot(self.camera_id)
                    output_payload["heatmap"] = heatmap_data

                if self.output_callback:
                    self.output_callback(output_payload)

            except Exception as e:
                logger.error(f"Pipeline Failure: {e}", exc_info=True)
            finally:
                del frame
                elapsed = time.time() - start_time
                wait = max(0, (1.0 / fps_conf) - elapsed)
                time.sleep(wait)
