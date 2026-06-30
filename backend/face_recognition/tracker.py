
import numpy as np
import logging
from typing import List, Dict, Tuple, Optional
from collections import deque
from scipy.optimize import linear_sum_assignment
from .config_manager import config_manager

logger = logging.getLogger("Tracker")

class TrackState:
    New = 0
    Tracked = 1
    Lost = 2
    Removed = 3

class KalmanFilter:
    """
    Standard Kalman Filter for bounding box tracking.
    State: [xc, yc, aspect_ratio, height, v_xc, v_yc, v_ar, v_h]
    """
    def __init__(self):
        ndim = 4
        dt = 1.

        self._motion_mat = np.eye(2 * ndim, 2 * ndim)
        for i in range(ndim):
            self._motion_mat[i, ndim + i] = dt
        self._update_mat = np.eye(ndim, 2 * ndim)

        self._std_weight_position = 1. / 20
        self._std_weight_velocity = 1. / 160

    def initiate(self, measurement):
        mean_pos = measurement
        mean_vel = np.zeros_like(mean_pos)
        mean = np.r_[mean_pos, mean_vel]

        std = [
            2 * self._std_weight_position * measurement[3],
            2 * self._std_weight_position * measurement[3],
            1e-2,
            2 * self._std_weight_position * measurement[3],
            10 * self._std_weight_velocity * measurement[3],
            10 * self._std_weight_velocity * measurement[3],
            1e-5,
            10 * self._std_weight_velocity * measurement[3]
        ]
        covariance = np.diag(np.square(std))
        return mean, covariance

    def predict(self, mean, covariance):
        std_pos = [
            self._std_weight_position * mean[3],
            self._std_weight_position * mean[3],
            1e-2,
            self._std_weight_position * mean[3]
        ]
        std_vel = [
            self._std_weight_velocity * mean[3],
            self._std_weight_velocity * mean[3],
            1e-5,
            self._std_weight_velocity * mean[3]
        ]
        motion_cov = np.diag(np.square(np.r_[std_pos, std_vel]))

        mean = np.dot(self._motion_mat, mean)
        covariance = np.linalg.multi_dot((
            self._motion_mat, covariance, self._motion_mat.T
        )) + motion_cov

        return mean, covariance

    def project(self, mean, covariance):
        std = [
            self._std_weight_position * mean[3],
            self._std_weight_position * mean[3],
            1e-2,
            self._std_weight_position * mean[3]
        ]
        innovation_cov = np.diag(np.square(std))

        mean = np.dot(self._update_mat, mean)
        covariance = np.linalg.multi_dot((
            self._update_mat, covariance, self._update_mat.T
        ))
        return mean, covariance + innovation_cov

    def update(self, mean, covariance, measurement):
        projected_mean, projected_cov = self.project(mean, covariance)

        chol_factor, lower = np.linalg.cho_factor(
            projected_cov, lower=True, check_finite=False
        )
        kalman_gain = np.linalg.cho_solve(
            (chol_factor, lower), np.dot(covariance, self._update_mat.T).T,
            check_finite=False
        ).T
        
        innovation = measurement - projected_mean
        new_mean = mean + np.dot(innovation, kalman_gain.T)
        new_covariance = covariance - np.linalg.multi_dot((
            kalman_gain, projected_cov, kalman_gain.T
        ))
        return new_mean, new_covariance

class STrack:
    """
    Single Object Track state container.
    """
    _kf = KalmanFilter()
    _id_counter = 1

    def __init__(self, tlwh, score, detection_obj):
        # detection_obj contains kps/landmarks from InsightFace
        self._tlwh = np.asarray(tlwh, dtype=np.float32)
        self.score = score
        self.detection_obj = detection_obj
        
        self.track_id = 0
        self.state = TrackState.New
        
        self.is_activated = False
        self.frame_id = 0
        self.start_frame = 0

        self.mean = None
        self.covariance = None
        
        # Extended attributes for application logic
        self.snapshot_id = None

    @property
    def end_frame(self):
        return self.frame_id

    def activate(self, kalman_filter, frame_id):
        """Start a new track"""
        self.track_id = self.next_id()
        self.mean, self.covariance = kalman_filter.initiate(self.tlwh_to_xyah(self._tlwh))
        self.state = TrackState.Tracked
        if frame_id == 1:
            self.is_activated = True
        self.frame_id = frame_id
        self.start_frame = frame_id

    def re_activate(self, new_track, frame_id, new_id=False):
        """Recover a lost track"""
        self.mean, self.covariance = self._kf.update(
            self.mean, self.covariance, self.tlwh_to_xyah(new_track.tlwh)
        )
        self.update_features(new_track)
        self.state = TrackState.Tracked
        self.is_activated = True
        self.frame_id = frame_id
        if new_id:
            self.track_id = self.next_id()

    def update(self, new_track, frame_id):
        """Update a matched track"""
        self.frame_id = frame_id
        self.update_features(new_track)
        
        self.mean, self.covariance = self._kf.update(
            self.mean, self.covariance, self.tlwh_to_xyah(new_track.tlwh)
        )
        self.state = TrackState.Tracked
        self.is_activated = True

    def update_features(self, new_track):
        self._tlwh = new_track.tlwh
        self.score = new_track.score
        # Always keep the freshest detection object (best landmarks)
        if new_track.detection_obj:
            self.detection_obj = new_track.detection_obj

    @property
    def tlwh(self):
        """Get current position in top-left-width-height"""
        if self.mean is None:
            return self._tlwh.copy()
        ret = self.mean[:4].copy()
        ret[2] *= ret[3]
        ret[:2] -= ret[2:] / 2
        return ret

    @property
    def bbox(self):
        """Get current bounding box in x1, y1, x2, y2"""
        ret = self.tlwh.copy()
        ret[2:] += ret[:2]
        return ret

    @staticmethod
    def tlwh_to_xyah(tlwh):
        """Convert bounding box to format Mean state [xc, yc, aspect, height]"""
        ret = np.asarray(tlwh).copy()
        ret[:2] += ret[2:] / 2
        ret[2] /= ret[3]
        return ret

    @staticmethod
    def next_id():
        STrack._id_counter += 1
        return STrack._id_counter

    def mark_lost(self):
        self.state = TrackState.Lost

    def mark_removed(self):
        self.state = TrackState.Removed
    
    def is_confirmed(self):
        return self.is_activated

class Tracker:
    """
    ByteTrack Implementation:
    Associates high score detections first, then low score detections to recover occluded faces.
    """
    def __init__(self, frame_rate=30):
        self.tracked_stracks: List[STrack] = []
        self.lost_stracks: List[STrack] = []
        self.removed_stracks: List[STrack] = []

        self.frame_id = 0
        self.kalman_filter = KalmanFilter()
        
        # Configuration mapping
        # Detection Threshold used to split High vs Low detections
        self.det_thresh = config_manager.detection.confidence_threshold
        # Tracks without match for 'max_age' frames are deleted
        self.max_time_lost = config_manager.tracking.max_age
        
    def update(self, detections: List[any], frame_shape: Tuple[int, int]) -> List[STrack]:
        self.frame_id += 1
        self.det_thresh = config_manager.detection.confidence_threshold # Sync dynamic config
        
        activated_starcks = []
        refind_stracks = []
        lost_stracks = []
        removed_stracks = []

        # 1. Separate Detections into High and Low scores
        # scores are stored in face.det_score
        scores = np.array([d.det_score for d in detections])
        bboxes = np.array([d.bbox for d in detections]) # x1, y1, x2, y2

        remain_inds = scores > self.det_thresh
        inds_low = scores > 0.1
        inds_high = scores < self.det_thresh

        inds_second = np.logical_and(inds_low, inds_high)

        # High Confidence Detections
        detections_high = [
            STrack(STrack.tlbr_to_tlwh(detections[i].bbox), detections[i].det_score, detections[i])
            for i in np.where(remain_inds)[0]
        ]
        
        # Low Confidence Detections
        detections_second = [
            STrack(STrack.tlbr_to_tlwh(detections[i].bbox), detections[i].det_score, detections[i])
            for i in np.where(inds_second)[0]
        ]

        # 2. Predict Track Positions
        strack_pool = self.joint_stracks(self.tracked_stracks, self.lost_stracks)
        self.multi_predict(strack_pool)

        # 3. Association Step 1: Match High Conf Detections with Tracks
        # Uses IoU Distance
        dists = self.iou_distance(strack_pool, detections_high)
        
        # Use simple Linear Assignment (Hungarian)
        # Match confirmed tracks first
        matches, u_track, u_detection = self.linear_assignment(dists, thresh=0.8) # 0.8 = 1 - iou_threshold (0.2 match)

        for itracked, idet in matches:
            track = strack_pool[itracked]
            det = detections_high[idet]
            if track.state == TrackState.Tracked:
                track.update(det, self.frame_id)
                activated_starcks.append(track)
            else:
                track.re_activate(det, self.frame_id, new_id=False)
                refind_stracks.append(track)

        # 4. Association Step 2: Match Remaining Tracks with Low Conf Detections
        # Only tracks that are currently 'Tracked' are eligible for second chance
        r_tracked_stracks = [strack_pool[i] for i in u_track if strack_pool[i].state == TrackState.Tracked]
        
        dists = self.iou_distance(r_tracked_stracks, detections_second)
        matches, u_track, u_detection_second = self.linear_assignment(dists, thresh=0.5) # Looser threshold for recovery

        for itracked, idet in matches:
            track = r_tracked_stracks[itracked]
            det = detections_second[idet]
            if track.state == TrackState.Tracked:
                track.update(det, self.frame_id)
                activated_starcks.append(track)
            else:
                track.re_activate(det, self.frame_id, new_id=False)
                refind_stracks.append(track)

        # 5. Handle Lost Tracks
        for it in u_track:
            track = r_tracked_stracks[it]
            if not track.state == TrackState.Lost:
                track.mark_lost()
                lost_stracks.append(track)

        # 6. Initialize New Tracks
        # Only high confidence unassociated detections create new tracks
        for inew in u_detection:
            track = detections_high[inew]
            if track.score < self.det_thresh:
                continue
            track.activate(self.kalman_filter, self.frame_id)
            activated_starcks.append(track)

        # 7. Update Logic
        # Cleanup 'Lost' tracks that are only found in 'u_track' of first stage but were NOT in 'r_tracked_stracks'
        # Basically tracks that were already Lost and failed to match high confidence
        # We need to preserve them in lost_stracks unless they expire
        
        # Add tracks that were Lost and didn't match High Dets (and skipped Second match)
        # Note: strack_pool = tracked + lost. u_track indices refer to pool.
        # Logic above handled 'Tracked' ones unmatched. Now check 'Lost' ones unmatched.
        for it in u_track:
            track = strack_pool[it]
            if track.state == TrackState.Lost:
                # Still lost
                lost_stracks.append(track)

        self.tracked_stracks = [t for t in self.tracked_stracks if t.state == TrackState.Tracked]
        self.tracked_stracks = self.sub_stracks(self.tracked_stracks, activated_starcks) # Remove duplicates if any
        self.tracked_stracks.extend(activated_starcks)
        self.tracked_stracks.extend(refind_stracks)
        
        self.lost_stracks = self.sub_stracks(self.lost_stracks, self.tracked_stracks)
        self.lost_stracks.extend(lost_stracks)
        self.lost_stracks = self.sub_stracks(self.lost_stracks, self.removed_stracks)
        
        # Remove expired tracks
        self.removed_stracks.extend([t for t in self.lost_stracks if self.frame_id - t.end_frame > self.max_time_lost])
        self.lost_stracks = [t for t in self.lost_stracks if self.frame_id - t.end_frame <= self.max_time_lost]

        # Combine active tracks for output
        active_outputs = [t for t in self.tracked_stracks if t.is_activated]
        
        # Return strict list
        return active_outputs

    def multi_predict(self, stracks):
        if len(stracks) > 0:
            multi_mean = np.asarray([st.mean.copy() for st in stracks])
            multi_covariance = np.asarray([st.covariance for st in stracks])
            for i, st in enumerate(stracks):
                if st.state != TrackState.Tracked:
                    # If lost, assume 0 velocity for smoother re-association
                    multi_mean[i][4] = 0
                    multi_mean[i][5] = 0
                    multi_mean[i][6] = 0
                    multi_mean[i][7] = 0
            
            for i, st in enumerate(stracks):
                st.mean, st.covariance = self.kalman_filter.predict(multi_mean[i], multi_covariance[i])

    def linear_assignment(self, cost_matrix, thresh):
        if cost_matrix.size == 0:
            return np.empty((0, 2), dtype=int), tuple(range(cost_matrix.shape[0])), tuple(range(cost_matrix.shape[1]))
        
        matches, unmatched_a, unmatched_b = [], [], []
        cost, x, y = linear_sum_assignment(cost_matrix)
        
        for i in range(len(x)):
            if cost_matrix[x[i], y[i]] > thresh:
                unmatched_a.append(x[i])
                unmatched_b.append(y[i])
            else:
                matches.append(np.array([x[i], y[i]]))

        # Find unmatched indices not in assignment result
        unmatched_a.extend([i for i in range(cost_matrix.shape[0]) if i not in x])
        unmatched_b.extend([i for i in range(cost_matrix.shape[1]) if i not in y])
        
        return np.asarray(matches), np.asarray(unmatched_a), np.asarray(unmatched_b)

    def iou_distance(self, atracks, btracks):
        if (len(atracks) == 0 or len(btracks) == 0):
            return np.zeros((len(atracks), len(btracks)))

        atlbr = [track.bbox for track in atracks]
        btlbr = [track.bbox for track in btracks]
        
        ious = self.bbox_ious(np.asarray(atlbr), np.asarray(btlbr))
        cost_matrix = 1 - ious
        return cost_matrix

    def bbox_ious(self, boxes1, boxes2):
        b1x1, b1y1 = boxes1[:, 0], boxes1[:, 1]
        b1x2, b1y2 = boxes1[:, 2], boxes1[:, 3]
        b2x1, b2y1 = boxes2[:, 0], boxes2[:, 1]
        b2x2, b2y2 = boxes2[:, 2], boxes2[:, 3]

        area1 = (b1x2 - b1x1) * (b1y2 - b1y1)
        area2 = (b2x2 - b2x1) * (b2y2 - b2y1)

        # Broadcasting for pairwise intersection
        xx1 = np.maximum(b1x1[:, None], b2x1)
        yy1 = np.maximum(b1y1[:, None], b2y1)
        xx2 = np.minimum(b1x2[:, None], b2x2)
        yy2 = np.minimum(b1y2[:, None], b2y2)

        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h

        return inter / (area1[:, None] + area2 - inter)

    @staticmethod
    def joint_stracks(tlist_a, tlist_b):
        exists = {}
        res = []
        for t in tlist_a:
            exists[t.track_id] = 1
            res.append(t)
        for t in tlist_b:
            if t.track_id not in exists:
                res.append(t)
        return res

    @staticmethod
    def sub_stracks(tlist_a, tlist_b):
        stracks = {}
        for t in tlist_a:
            stracks[t.track_id] = t
        for t in tlist_b:
            if t.track_id in stracks:
                del stracks[t.track_id]
        return list(stracks.values())

    # Helper to map format
    @staticmethod
    def tlbr_to_tlwh(tlbr):
        ret = np.asarray(tlbr).copy()
        ret[2:] -= ret[:2]
        return ret
