import sys
import os
import json
import cv2
import datetime
from pathlib import Path
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QGridLayout, QLabel, QLineEdit, QPushButton, QFormLayout,
    QGroupBox, QTextEdit, QSpinBox, QScrollArea, QSplitter,
    QMessageBox, QListWidget, QFrame
)
from PySide6.QtCore import Qt, Slot, QTimer
from PySide6.QtGui import QImage, QPixmap, QColor

from HikVisionManager.camera_manager import CameraConfig, CameraManager
from HikVisionManager.camera_widget import CameraWidget
from HikVisionManager.recorder import Recorder
from HikVisionManager.snapshot import SnapshotManager

CONFIG_FILE = "cameras_config.json"
RECORDINGS_DIR = Path("recordings")
SNAPSHOTS_DIR = Path("snapshots")


class FullscreenViewer(QWidget):
    """Clean frameless window for presenting a camera feed in fullscreen."""
    
    def __init__(self, camera_name: str, parent=None):
        super().__init__(parent)
        self.camera_name = camera_name
        self.setWindowTitle(f"{camera_name} - Fullscreen")
        self.setWindowFlags(Qt.Window | Qt.FramelessWindowHint)
        self.setStyleSheet("background-color: black;")
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        self.label = QLabel()
        self.label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.label)
        
        self.showFullScreen()
        
    def update_frame(self, frame):
        """Scale and render the frame."""
        if frame is None:
            return
            
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h, w, ch = rgb.shape
        bytes_per_line = ch * w
        qt_image = QImage(rgb.data, w, h, bytes_per_line, QImage.Format_RGB888)
        
        scaled = qt_image.scaled(
            self.size(),
            Qt.KeepAspectRatio,
            Qt.SmoothTransformation
        )
        self.label.setPixmap(QPixmap.fromImage(scaled))
        
    def keyPressEvent(self, event):
        """Close fullscreen view on Escape key press."""
        if event.key() == Qt.Key_Escape:
            self.close()
        else:
            super().keyPressEvent(event)
            
    def closeEvent(self, event):
        """Notify parent when closing."""
        if hasattr(self.parent(), "clear_fullscreen_viewer"):
            self.parent().clear_fullscreen_viewer()
        event.accept()


class MainWindow(QMainWindow):
    """Main window of the HikVision camera manager."""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("HikVision Camera Manager")
        self.resize(1200, 750)
        
        # Create directories
        RECORDINGS_DIR.mkdir(exist_ok=True)
        SNAPSHOTS_DIR.mkdir(exist_ok=True)
        
        # Initialize Core Managers
        self.camera_manager = CameraManager()
        self.snapshot_manager = SnapshotManager(SNAPSHOTS_DIR)
        
        # Connections & State
        self.camera_widgets = {}
        self.recorders = {}
        self.fullscreen_viewer = None
        
        # Apply dark theme styling
        self.apply_theme()
        
        # Setup UI
        self.setup_ui()
        
        # Connect Manager Signals
        self.camera_manager.frame_ready.connect(self.on_frame_ready)
        self.camera_manager.connection_status_changed.connect(self.on_connection_status_changed)
        self.camera_manager.error_occurred.connect(self.on_error_occurred)
        
        # Load and initialize cameras after window is shown
        QTimer.singleShot(200, self.initialize_cameras)
        
    def apply_theme(self):
        """Apply a sleek modern dark mode theme stylesheet."""
        self.setStyleSheet("""
            QMainWindow {
                background-color: #1a1a1a;
            }
            QWidget {
                font-family: 'Segoe UI', Arial, sans-serif;
                color: #e0e0e0;
            }
            QGroupBox {
                border: 1px solid #333333;
                border-radius: 6px;
                margin-top: 15px;
                font-weight: bold;
                padding-top: 10px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                subcontrol-position: top left;
                left: 10px;
                padding: 0 5px;
                color: #4CAF50;
            }
            QLineEdit, QSpinBox, QListWidget {
                background-color: #262626;
                border: 1px solid #444444;
                border-radius: 4px;
                padding: 5px;
                color: #ffffff;
            }
            QLineEdit:focus, QSpinBox:focus, QListWidget:focus {
                border: 1px solid #4CAF50;
            }
            QPushButton {
                background-color: #333333;
                border: 1px solid #555555;
                border-radius: 4px;
                padding: 6px 12px;
                color: #ffffff;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #444444;
            }
            QPushButton:pressed {
                background-color: #222222;
            }
            QPushButton#addBtn {
                background-color: #2e7d32;
                border: 1px solid #1b5e20;
            }
            QPushButton#addBtn:hover {
                background-color: #388e3c;
            }
            QPushButton#removeBtn {
                background-color: #c62828;
                border: 1px solid #b71c1c;
            }
            QPushButton#removeBtn:hover {
                background-color: #d32f2f;
            }
            QTextEdit {
                background-color: #121212;
                border: 1px solid #2d2d2d;
                font-family: 'Consolas', monospace;
                font-size: 11px;
                color: #a0a0a0;
            }
            QScrollBar:vertical {
                border: none;
                background-color: #2b2b2b;
                width: 8px;
                margin: 0px;
            }
            QScrollBar::handle:vertical {
                background-color: #444444;
                min-height: 20px;
                border-radius: 4px;
            }
            QScrollBar::handle:vertical:hover {
                background-color: #555555;
            }
        """)
        
    def setup_ui(self):
        """Construct the overall layout and subcomponents."""
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        
        main_layout = QHBoxLayout(main_widget)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)
        
        # Horizontal Splitter between feed grid and side panel
        splitter = QSplitter(Qt.Horizontal)
        main_layout.addWidget(splitter)
        
        # LEFT: Video feeds container inside scroll area
        self.grid_scroll = QScrollArea()
        self.grid_scroll.setWidgetResizable(True)
        self.grid_scroll.setFrameShape(QFrame.NoFrame)
        
        self.grid_container = QWidget()
        self.grid_layout = QGridLayout(self.grid_container)
        self.grid_layout.setContentsMargins(5, 5, 5, 5)
        self.grid_layout.setSpacing(8)
        
        # Grid placeholder when no camera is present
        self.placeholder_label = QLabel("No Cameras Added.\nUse the panel on the right to add video feeds.")
        self.placeholder_label.setAlignment(Qt.AlignCenter)
        self.placeholder_label.setStyleSheet("color: #666666; font-size: 16px; font-weight: bold;")
        self.grid_layout.addWidget(self.placeholder_label, 0, 0)
        
        self.grid_scroll.setWidget(self.grid_container)
        splitter.addWidget(self.grid_scroll)
        
        # RIGHT: Control panel widget
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(10)
        
        # 1. Add Camera GroupBox
        add_group = QGroupBox("Add New Camera")
        add_layout = QFormLayout(add_group)
        add_layout.setSpacing(8)
        
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("e.g. Backyard Camera")
        self.ip_input = QLineEdit()
        self.ip_input.setPlaceholderText("IP Address, filepath, or webcam index")
        
        self.user_input = QLineEdit()
        self.user_input.setPlaceholderText("admin")
        self.pwd_input = QLineEdit()
        self.pwd_input.setEchoMode(QLineEdit.Password)
        
        self.channel_input = QSpinBox()
        self.channel_input.setRange(1, 99999)
        self.channel_input.setValue(101)
        
        add_layout.addRow("Display Name:", self.name_input)
        add_layout.addRow("IP/Source:", self.ip_input)
        add_layout.addRow("Username:", self.user_input)
        add_layout.addRow("Password:", self.pwd_input)
        add_layout.addRow("Channel:", self.channel_input)
        
        self.add_btn = QPushButton("Add Camera")
        self.add_btn.setObjectName("addBtn")
        self.add_btn.clicked.connect(self.on_add_camera_clicked)
        add_layout.addRow(self.add_btn)
        
        right_layout.addWidget(add_group)
        
        # 2. Configured Cameras list
        list_group = QGroupBox("Connected Cameras")
        list_layout = QVBoxLayout(list_group)
        
        self.cameras_list = QListWidget()
        list_layout.addWidget(self.cameras_list)
        
        self.remove_btn = QPushButton("Remove Selected")
        self.remove_btn.setObjectName("removeBtn")
        self.remove_btn.clicked.connect(self.on_remove_camera_clicked)
        list_layout.addWidget(self.remove_btn)
        
        right_layout.addWidget(list_group)
        
        # 3. Status Logs panel
        log_group = QGroupBox("System Logs")
        log_layout = QVBoxLayout(log_group)
        self.log_console = QTextEdit()
        self.log_console.setReadOnly(True)
        log_layout.addWidget(self.log_console)
        
        right_layout.addWidget(log_group)
        
        # Set sizing ratios in splitter
        splitter.addWidget(right_panel)
        splitter.setSizes([850, 350])
        
        self.log("System initialized.")
        
    def log(self, message: str):
        """Append messages to the log output console."""
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.log_console.append(f"[{timestamp}] {message}")
        
    def load_cameras_config(self):
        """Load list of camera settings from JSON."""
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r') as f:
                    return json.load(f)
            except Exception as e:
                self.log(f"Error loading config file: {e}")
                
        # Return default configs if none exist
        default_config = [
            {
                "name": "Hikvision Main",
                "ip": "192.168.1.64",
                "username": "admin",
                "password": "kINGROOT888",
                "channel": 101
            }
        ]
        self.save_cameras_config(default_config)
        return default_config
        
    def save_cameras_config(self, config_list):
        """Save settings list to JSON file."""
        try:
            with open(CONFIG_FILE, 'w') as f:
                json.dump(config_list, f, indent=4)
        except Exception as e:
            self.log(f"Error saving config file: {e}")
            
    def initialize_cameras(self):
        """Connect configured cameras and build UI widgets."""
        configs = self.load_cameras_config()
        for cfg in configs:
            camera_cfg = CameraConfig(
                name=cfg["name"],
                ip=cfg["ip"],
                username=cfg["username"],
                password=cfg["password"],
                channel=cfg.get("channel", 101)
            )
            
            widget = CameraWidget(camera_cfg.name)
            widget.record_clicked.connect(self.on_record_clicked)
            widget.snapshot_clicked.connect(self.on_snapshot_clicked)
            widget.fullscreen_requested.connect(self.on_fullscreen_requested)
            
            self.camera_widgets[camera_cfg.name] = widget
            self.camera_manager.add_camera(camera_cfg)
            
        self.update_grid_layout()
        self.update_cameras_list_ui()
        
    def update_grid_layout(self):
        """Rearrange widgets inside grid layout depending on camera count."""
        # Unparent all widgets
        for i in reversed(range(self.grid_layout.count())):
            item = self.grid_layout.itemAt(i)
            if item.widget():
                item.widget().setParent(None)
                
        n = len(self.camera_widgets)
        if n == 0:
            self.placeholder_label.show()
            self.grid_layout.addWidget(self.placeholder_label, 0, 0)
            return
            
        self.placeholder_label.hide()
        
        # Decide grid structure based on count
        cols = 2 if n > 1 else 1
        for idx, (name, widget) in enumerate(self.camera_widgets.items()):
            row = idx // cols
            col = idx % cols
            self.grid_layout.addWidget(widget, row, col)
            
    def update_cameras_list_ui(self):
        """Update cameras listed in control sidebar."""
        self.cameras_list.clear()
        self.cameras_list.addItems(list(self.camera_widgets.keys()))
        
    @Slot(str, object)
    def on_frame_ready(self, name: str, frame):
        """Dispatch incoming frame to widget, recorder, and fullscreen window."""
        if name in self.camera_widgets:
            self.camera_widgets[name].update_frame(frame)
            
        if name in self.recorders:
            recorder = self.recorders[name]
            if recorder.is_recording():
                recorder.write_frame(frame)
                
        if self.fullscreen_viewer and self.fullscreen_viewer.camera_name == name:
            self.fullscreen_viewer.update_frame(frame)
            
    @Slot(str, bool)
    def on_connection_status_changed(self, name: str, connected: bool):
        """Update connection indicator color on status change."""
        if name in self.camera_widgets:
            self.camera_widgets[name].set_connection_status(connected)
        self.log(f"[{name}] Connection: {'Online' if connected else 'Offline'}")
        
    @Slot(str, str)
    def on_error_occurred(self, name: str, error_msg: str):
        """Log camera errors to console log."""
        self.log(f"[{name}] Connection error: {error_msg}")
        
    @Slot(str)
    def on_record_clicked(self, name: str):
        """Toggle video stream recording thread."""
        if name not in self.camera_widgets:
            return
            
        widget = self.camera_widgets[name]
        
        if name in self.recorders:
            recorder = self.recorders[name]
            if recorder.is_recording():
                recorder.stop_recording()
                widget.set_recording(False)
                self.log(f"[{name}] Stopped video recording.")
                return
        else:
            recorder = Recorder(name, RECORDINGS_DIR)
            recorder.recording_error.connect(self.on_recording_error)
            recorder.frame_dropped.connect(self.on_frame_dropped)
            self.recorders[name] = recorder
            
        success = recorder.start_recording()
        if success:
            widget.set_recording(True)
            self.log(f"[{name}] Started video recording.")
        else:
            self.log(f"[{name}] Failed to start recording.")
            
    @Slot(str)
    def on_snapshot_clicked(self, name: str):
        """Capture and save snapshot frame as JPEG image."""
        frame = self.camera_manager.get_frame(name)
        if frame is not None:
            path = self.snapshot_manager.save_snapshot(name, frame)
            if path:
                self.log(f"[{name}] Snapshot saved to: {path}")
            else:
                self.log(f"[{name}] Snapshot failed.")
        else:
            self.log(f"[{name}] No frame buffer available.")
            
    @Slot(str)
    def on_fullscreen_requested(self, name: str):
        """Show full screen view modal of stream."""
        if self.fullscreen_viewer:
            self.fullscreen_viewer.close()
            
        self.fullscreen_viewer = FullscreenViewer(name, self)
        self.fullscreen_viewer.show()
        self.log(f"[{name}] Opened fullscreen viewer. Press ESC to return.")
        
    def clear_fullscreen_viewer(self):
        """Clean reference to closed fullscreen modal."""
        self.fullscreen_viewer = None
        
    @Slot(str, str)
    def on_recording_error(self, name: str, err: str):
        """Log recording failures and update UI."""
        self.log(f"[{name}] Recorder error: {err}")
        if name in self.camera_widgets:
            self.camera_widgets[name].set_recording(False)
            
    @Slot(str)
    def on_frame_dropped(self, name: str):
        """Log dropped frames to console."""
        self.log(f"[{name}] Frame dropped - writing slower than incoming stream.")
        
    def on_add_camera_clicked(self):
        """Validate and add a new camera configurations dynamically."""
        name = self.name_input.text().strip()
        ip = self.ip_input.text().strip()
        user = self.user_input.text().strip()
        pwd = self.pwd_input.text().strip()
        channel = self.channel_input.value()
        
        if not name or not ip:
            QMessageBox.warning(self, "Input Error", "Name and IP/Source fields are required.")
            return
            
        if name in self.camera_widgets:
            QMessageBox.warning(self, "Input Error", f"A camera named '{name}' is already loaded.")
            return
            
        camera_cfg = CameraConfig(
            name=name,
            ip=ip,
            username=user,
            password=pwd,
            channel=channel
        )
        
        if not self.camera_manager.add_camera(camera_cfg):
            QMessageBox.critical(self, "Error", f"Failed to load camera '{name}'.")
            return
            
        widget = CameraWidget(name)
        widget.record_clicked.connect(self.on_record_clicked)
        widget.snapshot_clicked.connect(self.on_snapshot_clicked)
        widget.fullscreen_requested.connect(self.on_fullscreen_requested)
        
        self.camera_widgets[name] = widget
        
        # Update json list
        configs = self.load_cameras_config()
        configs.append({
            "name": name,
            "ip": ip,
            "username": user,
            "password": pwd,
            "channel": channel
        })
        self.save_cameras_config(configs)
        
        self.update_grid_layout()
        self.update_cameras_list_ui()
        
        self.name_input.clear()
        self.ip_input.clear()
        self.user_input.clear()
        self.pwd_input.clear()
        self.channel_input.setValue(101)
        self.log(f"Added camera '{name}'.")
        
    def on_remove_camera_clicked(self):
        """Remove selected camera, terminate feeds and recording."""
        selected = self.cameras_list.selectedItems()
        if not selected:
            QMessageBox.warning(self, "Selection Required", "Please select a camera to remove.")
            return
            
        name = selected[0].text()
        
        reply = QMessageBox.question(
            self, "Remove Camera",
            f"Are you sure you want to stop and delete '{name}'?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No
        )
        if reply == QMessageBox.No:
            return
            
        # Stop recording
        if name in self.recorders:
            recorder = self.recorders[name]
            if recorder.is_recording():
                recorder.stop_recording()
            del self.recorders[name]
            
        # Stop connection thread
        self.camera_manager.remove_camera(name)
        
        # Remove Widget
        if name in self.camera_widgets:
            widget = self.camera_widgets[name]
            widget.setParent(None)
            widget.deleteLater()
            del self.camera_widgets[name]
            
        # Save modifications to JSON
        configs = self.load_cameras_config()
        configs = [cfg for cfg in configs if cfg["name"] != name]
        self.save_cameras_config(configs)
        
        # Update layout
        self.update_grid_layout()
        self.update_cameras_list_ui()
        
        self.log(f"Removed camera '{name}'.")
        
    def closeEvent(self, event):
        """Clean up threads and recorders on exit."""
        self.log("Stopping all camera connections and recordings...")
        for name in list(self.recorders.keys()):
            if self.recorders[name].is_recording():
                self.recorders[name].stop_recording()
                
        for name in list(self.camera_widgets.keys()):
            self.camera_manager.remove_camera(name)
            
        event.accept()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
