"""Reusable camera widget for HikVisionManager."""

import cv2
from typing import Optional
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QLabel, QPushButton, QHBoxLayout,
    QFrame, QSizePolicy
)
from PySide6.QtGui import QPixmap, QImage, QPainter, QColor
from PySide6.QtCore import Qt, Signal, QTimer


class CameraWidget(QWidget):
    """Reusable widget for displaying camera feed."""
    
    fullscreen_requested = Signal(str)
    record_clicked = Signal(str)
    snapshot_clicked = Signal(str)
    
    def __init__(self, name: str, parent=None):
        super().__init__(parent)
        self.name = name
        self._frame: Optional[cv2.Mat] = None
        self._recording = False
        self._recording_time = 0
        self._timer: Optional[QTimer] = None
        
        self._setup_ui()
        
    def _setup_ui(self):
        """Setup widget UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(2, 2, 2, 2)
        layout.setSpacing(2)
        
        self._video_label = QLabel()
        self._video_label.setAlignment(Qt.AlignCenter)
        self._video_label.setSizePolicy(QSizePolicy.Ignored, QSizePolicy.Ignored)
        self._video_label.setStyleSheet("background-color: black;")
        self._video_label.setMinimumSize(320, 180)
        layout.addWidget(self._video_label)
        
        self._info_frame = QFrame()
        self._info_frame.setFixedHeight(25)
        self._info_frame.setStyleSheet("""
            QFrame {
                background-color: rgba(0, 0, 0, 150);
                border: none;
            }
        """)
        info_layout = QHBoxLayout(self._info_frame)
        info_layout.setContentsMargins(5, 2, 5, 2)
        
        self._name_label = QLabel(self.name)
        self._name_label.setStyleSheet("color: white; font-size: 11px;")
        
        self._status_indicator = QLabel()
        self._status_indicator.setFixedSize(10, 10)
        self._status_indicator.setStyleSheet("background-color: red; border-radius: 5px;")
        
        self._recording_indicator = QLabel()
        self._recording_indicator.setFixedSize(10, 10)
        self._recording_indicator.setStyleSheet("background-color: gray; border-radius: 5px;")
        self._recording_indicator.hide()
        
        self._timer_label = QLabel("00:00")
        self._timer_label.setStyleSheet("color: white; font-size: 11px;")
        self._timer_label.hide()
        
        self._buttons_widget = QWidget()
        buttons_layout = QHBoxLayout(self._buttons_widget)
        buttons_layout.setContentsMargins(0, 0, 0, 0)
        buttons_layout.setSpacing(5)
        
        self._record_btn = QPushButton("● Record")
        self._record_btn.setFixedSize(60, 20)
        self._record_btn.setStyleSheet("""
            QPushButton {
                background-color: #444444;
                color: white;
                font-size: 10px;
                border: 1px solid #666666;
            }
            QPushButton:hover {
                background-color: #555555;
            }
        """)
        self._record_btn.clicked.connect(lambda: self.record_clicked.emit(self.name))
        
        self._snapshot_btn = QPushButton("📸")
        self._snapshot_btn.setFixedSize(30, 20)
        self._snapshot_btn.setStyleSheet("""
            QPushButton {
                background-color: #444444;
                color: white;
                font-size: 10px;
                border: 1px solid #666666;
            }
            QPushButton:hover {
                background-color: #555555;
            }
        """)
        self._snapshot_btn.clicked.connect(lambda: self.snapshot_clicked.emit(self.name))
        
        self._fullscreen_btn = QPushButton("⛶")
        self._fullscreen_btn.setFixedSize(30, 20)
        self._fullscreen_btn.setStyleSheet("""
            QPushButton {
                background-color: #444444;
                color: white;
                font-size: 10px;
                border: 1px solid #666666;
            }
            QPushButton:hover {
                background-color: #555555;
            }
        """)
        self._fullscreen_btn.clicked.connect(lambda: self.fullscreen_requested.emit(self.name))
        
        buttons_layout.addWidget(self._record_btn)
        buttons_layout.addWidget(self._snapshot_btn)
        buttons_layout.addWidget(self._fullscreen_btn)
        buttons_layout.addStretch()
        
        info_layout.addWidget(self._status_indicator)
        info_layout.addWidget(self._name_label)
        info_layout.addStretch()
        info_layout.addWidget(self._timer_label)
        info_layout.addWidget(self._recording_indicator)
        info_layout.addWidget(self._buttons_widget)
        
        layout.addWidget(self._info_frame)
        
    def update_frame(self, frame):
        """Update displayed frame."""
        self._frame = frame
        self._update_pixmap(frame)
        
    def _update_pixmap(self, frame):
        """Convert and display frame as pixmap."""
        if frame is None:
            return
            
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h, w, ch = rgb.shape
        bytes_per_line = ch * w
        qt_image = QImage(rgb.data, w, h, bytes_per_line, QImage.Format_RGB888)
        
        label_size = self._video_label.size()
        if label_size.width() > 0 and label_size.height() > 0:
            scaled = qt_image.scaled(
                label_size,
                Qt.KeepAspectRatio,
                Qt.SmoothTransformation
            )
        else:
            scaled = qt_image
            
        self._video_label.setPixmap(QPixmap.fromImage(scaled))
        
    def set_connection_status(self, connected: bool):
        """Update connection status indicator."""
        color = "green" if connected else "red"
        self._status_indicator.setStyleSheet(
            f"background-color: {color}; border-radius: 5px;"
        )
        
    def set_recording(self, recording: bool):
        """Update recording indicator and timer."""
        self._recording = recording
        self._recording_indicator.setVisible(recording)
        self._recording_indicator.setStyleSheet(
            "background-color: red; border-radius: 5px;" if recording
            else "background-color: gray; border-radius: 5px;"
        )
        
        if recording:
            self._recording_time = 0
            self._timer_label.show()
            if not self._timer:
                self._timer = QTimer(self)
                self._timer.timeout.connect(self._update_timer)
            self._timer.start(1000)
        else:
            if self._timer:
                self._timer.stop()
            self._timer_label.hide()
            self._record_btn.setText("● Record")
            
    def _update_timer(self):
        """Update recording timer display."""
        self._recording_time += 1
        mins, secs = divmod(self._recording_time, 60)
        hours, mins = divmod(mins, 60)
        self._timer_label.setText(f"{hours:02d}:{mins:02d}:{secs:02d}")
        self._record_btn.setText("■ Stop")
        
    def resizeEvent(self, event):
        """Handle resize with aspect ratio."""
        super().resizeEvent(event)
        if self._frame is not None:
            self._update_pixmap(self._frame)