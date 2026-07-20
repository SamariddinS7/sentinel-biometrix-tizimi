"""
sentinel_main.py — Unified Sentinel Biometrix + HikVisionManager launcher.

This script:
  1. Reads cameras_config.json
  2. Starts HikVisionManager GUI (PySide6 MainWindow)
  3. Bridges each camera's RTSP stream through HikVisionBridge
  4. Optionally connects to Sentinel AI pipeline (face detection/recognition)
     if dependencies (InsightFace, ONNX) are installed

Usage:
    cd c:\\Users\\Acer\\Desktop\\qwerty
    py sentinel_main.py
"""

import sys
import os
import json
import logging
import datetime
import cv2
from pathlib import Path

# ── Configure logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("SentinelMain")

# ── PySide6 imports ──────────────────────────────────────────────────────────
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QGridLayout, QLabel, QLineEdit, QPushButton, QFormLayout,
    QGroupBox, QTextEdit, QSpinBox, QScrollArea, QSplitter,
    QMessageBox, QListWidget, QFrame, QTabWidget
)
from PySide6.QtCore import Qt, Slot, QTimer, Signal, QObject
from PySide6.QtGui import QImage, QPixmap

# ── HikVisionManager imports ─────────────────────────────────────────────────
from HikVisionManager.camera_manager import CameraConfig, CameraManager, CameraThread
from HikVisionManager.camera_widget import CameraWidget
from HikVisionManager.recorder import Recorder
from HikVisionManager.snapshot import SnapshotManager

# ── Sentinel Bridge import ───────────────────────────────────────────────────
# Add sentinel repo to path
SENTINEL_PATH = Path(__file__).parent / "sentinel-biometrix-tizimi"
sys.path.insert(0, str(SENTINEL_PATH))

try:
    from backend.hikvision_bridge import HikVisionBridge
    BRIDGE_AVAILABLE = True
    logger.info("HikVisionBridge loaded successfully.")
except Exception as e:
    logger.warning(f"HikVisionBridge not available: {e}")
    BRIDGE_AVAILABLE = False

CONFIG_FILE = "cameras_config.json"
RECORDINGS_DIR = Path("recordings")
SNAPSHOTS_DIR = Path("snapshots")


class SignalRelay(QObject):
    """Qt signal relay for cross-thread frame/status signals from bridge."""
    frame_ready = Signal(str, object)
    status_changed = Signal(str, bool)
    error_signal = Signal(str, str)


class FullscreenViewer(QWidget):
    """Frameless full-screen viewer for a single camera feed."""

    def __init__(self, camera_name: str, parent=None):
        super().__init__(parent)
        self.camera_name = camera_name
        self.setWindowTitle(f"{camera_name} — Fullscreen")
        self.setWindowFlags(Qt.Window | Qt.FramelessWindowHint)
        self.setStyleSheet("background-color: black;")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        self.label = QLabel()
        self.label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.label)
        self.showFullScreen()

    def update_frame(self, frame):
        if frame is None:
            return
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h, w, ch = rgb.shape
        qt_image = QImage(rgb.data, w, h, ch * w, QImage.Format_RGB888)
        scaled = qt_image.scaled(self.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation)
        self.label.setPixmap(QPixmap.fromImage(scaled))

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self.close()
        else:
            super().keyPressEvent(event)

    def closeEvent(self, event):
        if hasattr(self.parent(), "clear_fullscreen_viewer"):
            self.parent().clear_fullscreen_viewer()
        event.accept()


class SentinelMainWindow(QMainWindow):
    """
    Unified Sentinel Biometrix + HikVisionManager main window.

    Tabs:
      • Live Cameras   — grid of RTSP feeds with record/snapshot/fullscreen
      • Add Camera     — form to add new cameras (saved to cameras_config.json)
      • System Log     — live log console
    """

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Sentinel Biometrix — Camera Management System")
        self.resize(1280, 800)

        RECORDINGS_DIR.mkdir(exist_ok=True)
        SNAPSHOTS_DIR.mkdir(exist_ok=True)

        # Core managers
        self.hik_manager = CameraManager()        # PySide6 QThread-based RTSP manager
        self.snapshot_manager = SnapshotManager(SNAPSHOTS_DIR)

        # State
        self.camera_widgets: dict[str, CameraWidget] = {}
        self.recorders: dict[str, Recorder] = {}
        self.fullscreen_viewer: FullscreenViewer | None = None

        # Sentinel bridge (optional AI integration)
        self.bridge: HikVisionBridge | None = None
        if BRIDGE_AVAILABLE:
            try:
                self.bridge = HikVisionBridge(CONFIG_FILE)
                logger.info("HikVisionBridge initialized.")
            except Exception as e:
                logger.warning(f"Bridge init failed: {e}")
                self.bridge = None

        self._apply_theme()
        self._setup_ui()

        # Connect HikVisionManager signals
        self.hik_manager.frame_ready.connect(self._on_frame_ready)
        self.hik_manager.connection_status_changed.connect(self._on_status_changed)
        self.hik_manager.error_occurred.connect(self._on_error)

        # Defer camera init until window is shown
        QTimer.singleShot(300, self._initialize_cameras)

    # ── Theme ────────────────────────────────────────────────────────────────

    def _apply_theme(self):
        self.setStyleSheet("""
            QMainWindow, QWidget { background-color: #0f1117; color: #e2e8f0;
                font-family: 'Segoe UI', Arial, sans-serif; }
            QTabWidget::pane { border: 1px solid #1e293b; }
            QTabBar::tab { background: #1e293b; color: #94a3b8; padding: 8px 18px;
                border-radius: 4px 4px 0 0; margin-right: 2px; }
            QTabBar::tab:selected { background: #0f172a; color: #38bdf8;
                border-bottom: 2px solid #38bdf8; }
            QGroupBox { border: 1px solid #1e293b; border-radius: 6px;
                margin-top: 14px; font-weight: bold; padding-top: 10px; }
            QGroupBox::title { color: #38bdf8; left: 10px; padding: 0 5px; }
            QLineEdit, QSpinBox, QListWidget {
                background: #1e293b; border: 1px solid #334155;
                border-radius: 4px; padding: 5px; color: #f1f5f9; }
            QLineEdit:focus, QSpinBox:focus { border: 1px solid #38bdf8; }
            QPushButton { background: #1e293b; border: 1px solid #334155;
                border-radius: 4px; padding: 7px 14px; color: #f1f5f9; font-weight: bold; }
            QPushButton:hover { background: #334155; }
            QPushButton#addBtn { background: #0f4c75; border-color: #1a6fa0; }
            QPushButton#addBtn:hover { background: #1565c0; }
            QPushButton#removeBtn { background: #7f1d1d; border-color: #991b1b; }
            QPushButton#removeBtn:hover { background: #991b1b; }
            QTextEdit { background: #080c14; border: 1px solid #1e293b;
                font-family: Consolas, monospace; font-size: 11px; color: #64748b; }
            QScrollBar:vertical { background: #1e293b; width: 7px; }
            QScrollBar::handle:vertical { background: #334155; border-radius: 3px; }
            QSplitter::handle { background: #1e293b; }
        """)

    # ── UI Setup ─────────────────────────────────────────────────────────────

    def _setup_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QHBoxLayout(central)
        main_layout.setContentsMargins(8, 8, 8, 8)
        main_layout.setSpacing(8)

        splitter = QSplitter(Qt.Horizontal)
        main_layout.addWidget(splitter)

        # ── LEFT: Tab panel ──────────────────────────────────────────────
        tabs = QTabWidget()

        # Tab 1 — Live Cameras
        live_tab = QWidget()
        live_layout = QVBoxLayout(live_tab)
        live_layout.setContentsMargins(4, 4, 4, 4)

        # Status bar
        status_bar = QWidget()
        status_bar.setFixedHeight(32)
        status_bar.setStyleSheet("background: #0f172a; border-radius: 4px;")
        sb_layout = QHBoxLayout(status_bar)
        sb_layout.setContentsMargins(10, 0, 10, 0)
        self._status_label = QLabel("🟢 Sentinel Biometrix — Camera Management System")
        self._status_label.setStyleSheet("color: #38bdf8; font-weight: bold; font-size: 12px;")
        sb_layout.addWidget(self._status_label)
        sb_layout.addStretch()
        ai_badge = QLabel("🤖 AI Pipeline: Stream-Only" if not BRIDGE_AVAILABLE else "🤖 AI Pipeline: Active")
        ai_badge.setStyleSheet("color: #64748b; font-size: 11px;")
        sb_layout.addWidget(ai_badge)
        live_layout.addWidget(status_bar)

        # Grid scroll area
        self._grid_scroll = QScrollArea()
        self._grid_scroll.setWidgetResizable(True)
        self._grid_scroll.setFrameShape(QFrame.NoFrame)
        self._grid_container = QWidget()
        self._grid_layout = QGridLayout(self._grid_container)
        self._grid_layout.setSpacing(6)
        self._grid_layout.setContentsMargins(4, 4, 4, 4)

        self._placeholder = QLabel(
            "📷  Kameralar topilmadi\n\nO'ng paneldan yangi kamera qo'shing"
        )
        self._placeholder.setAlignment(Qt.AlignCenter)
        self._placeholder.setStyleSheet("color: #334155; font-size: 18px; font-weight: bold;")
        self._grid_layout.addWidget(self._placeholder, 0, 0)
        self._grid_scroll.setWidget(self._grid_container)
        live_layout.addWidget(self._grid_scroll)

        tabs.addTab(live_tab, "📹  Live Kameralar")

        # Tab 2 — Logs
        log_tab = QWidget()
        log_layout = QVBoxLayout(log_tab)
        log_layout.setContentsMargins(4, 4, 4, 4)
        self._log_console = QTextEdit()
        self._log_console.setReadOnly(True)
        log_layout.addWidget(self._log_console)
        tabs.addTab(log_tab, "📋  System Log")

        splitter.addWidget(tabs)

        # ── RIGHT: Control panel ─────────────────────────────────────────
        right_panel = QWidget()
        right_panel.setMaximumWidth(360)
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(10)

        # Add camera form
        add_group = QGroupBox("➕  Kamera Qo'shish")
        add_form = QFormLayout(add_group)
        add_form.setSpacing(7)

        self._name_in = QLineEdit(); self._name_in.setPlaceholderText("Bosh hall kamera")
        self._ip_in = QLineEdit(); self._ip_in.setPlaceholderText("192.168.1.64 yoki 0 (webcam)")
        self._user_in = QLineEdit(); self._user_in.setPlaceholderText("admin")
        self._pwd_in = QLineEdit(); self._pwd_in.setEchoMode(QLineEdit.Password)
        self._ch_in = QSpinBox(); self._ch_in.setRange(1, 99999); self._ch_in.setValue(101)

        add_form.addRow("Nom:", self._name_in)
        add_form.addRow("IP/Manba:", self._ip_in)
        add_form.addRow("Login:", self._user_in)
        add_form.addRow("Parol:", self._pwd_in)
        add_form.addRow("Kanal:", self._ch_in)

        add_btn = QPushButton("Kamera Qo'shish")
        add_btn.setObjectName("addBtn")
        add_btn.clicked.connect(self._on_add_camera)
        add_form.addRow(add_btn)
        right_layout.addWidget(add_group)

        # Camera list
        list_group = QGroupBox("📷  Ulangan Kameralar")
        list_layout = QVBoxLayout(list_group)
        self._cam_list = QListWidget()
        list_layout.addWidget(self._cam_list)
        remove_btn = QPushButton("Tanlanganni O'chirish")
        remove_btn.setObjectName("removeBtn")
        remove_btn.clicked.connect(self._on_remove_camera)
        list_layout.addWidget(remove_btn)
        right_layout.addWidget(list_group)

        # Sentinel info box
        info_group = QGroupBox("ℹ️  Tizim Ma'lumotlari")
        info_layout = QVBoxLayout(info_group)
        info_text = QLabel(
            "🔴 RTSP Ulanish: HikVisionManager\n"
            "🤖 AI Pipeline: Sentinel Biometrix\n"
            "💾 Yozuvlar: recordings/\n"
            "📸 Rasmlar: snapshots/"
        )
        info_text.setStyleSheet("color: #64748b; font-size: 11px; line-height: 1.6;")
        info_layout.addWidget(info_text)
        right_layout.addWidget(info_group)

        right_layout.addStretch()
        splitter.addWidget(right_panel)
        splitter.setSizes([900, 360])

        self._log("Sentinel Biometrix Camera Management System ishga tushdi.")
        if BRIDGE_AVAILABLE:
            self._log("✅ HikVisionBridge ulandi — AI pipeline faol.")
        else:
            self._log("⚠️  AI pipeline mavjud emas — faqat jonli tasvirlar ko'rsatiladi.")

    # ── Camera initialization ────────────────────────────────────────────────

    def _initialize_cameras(self):
        """Load cameras_config.json and start all cameras."""
        configs = self._load_config()
        for cfg in configs:
            self._start_camera(cfg)
        self._refresh_grid()
        self._refresh_list()

    def _start_camera(self, cfg: dict):
        name = cfg["name"]
        if name in self.camera_widgets:
            return

        cam_cfg = CameraConfig(
            name=name,
            ip=cfg["ip"],
            username=cfg.get("username", ""),
            password=cfg.get("password", ""),
            channel=cfg.get("channel", 101),
        )

        widget = CameraWidget(name)
        widget.record_clicked.connect(self._on_record_clicked)
        widget.snapshot_clicked.connect(self._on_snapshot_clicked)
        widget.fullscreen_requested.connect(self._on_fullscreen_requested)
        self.camera_widgets[name] = widget

        self.hik_manager.add_camera(cam_cfg)
        self._log(f"[{name}] Kamera ulanmoqda → {cam_cfg.rtsp_url}")

    # ── Slot handlers ────────────────────────────────────────────────────────

    @Slot(str, object)
    def _on_frame_ready(self, name: str, frame):
        if name in self.camera_widgets:
            self.camera_widgets[name].update_frame(frame)
        if name in self.recorders and self.recorders[name].is_recording():
            self.recorders[name].write_frame(frame)
        if self.fullscreen_viewer and self.fullscreen_viewer.camera_name == name:
            self.fullscreen_viewer.update_frame(frame)

    @Slot(str, bool)
    def _on_status_changed(self, name: str, connected: bool):
        if name in self.camera_widgets:
            self.camera_widgets[name].set_connection_status(connected)
        status = "🟢 Online" if connected else "🔴 Offline"
        self._log(f"[{name}] {status}")

    @Slot(str, str)
    def _on_error(self, name: str, msg: str):
        self._log(f"[{name}] ⚠️  {msg}")

    @Slot(str)
    def _on_record_clicked(self, name: str):
        widget = self.camera_widgets.get(name)
        if not widget:
            return
        if name in self.recorders and self.recorders[name].is_recording():
            self.recorders[name].stop_recording()
            widget.set_recording(False)
            self._log(f"[{name}] ⏹  Video yozuv to'xtatildi.")
            return
        if name not in self.recorders:
            rec = Recorder(name, RECORDINGS_DIR)
            rec.recording_error.connect(lambda n, e: self._log(f"[{n}] Yozuv xatosi: {e}"))
            self.recorders[name] = rec
        if self.recorders[name].start_recording():
            widget.set_recording(True)
            self._log(f"[{name}] 🔴 Video yozuv boshlandi.")

    @Slot(str)
    def _on_snapshot_clicked(self, name: str):
        frame = self.hik_manager.get_frame(name)
        if frame is not None:
            path = self.snapshot_manager.save_snapshot(name, frame)
            if path:
                self._log(f"[{name}] 📸 Rasm saqlandi: {path}")
        else:
            self._log(f"[{name}] ⚠️  Rasm olish uchun kadr yo'q.")

    @Slot(str)
    def _on_fullscreen_requested(self, name: str):
        if self.fullscreen_viewer:
            self.fullscreen_viewer.close()
        self.fullscreen_viewer = FullscreenViewer(name, self)
        self._log(f"[{name}] To'liq ekran (ESC — qaytish).")

    def clear_fullscreen_viewer(self):
        self.fullscreen_viewer = None

    def _on_add_camera(self):
        name = self._name_in.text().strip()
        ip = self._ip_in.text().strip()
        user = self._user_in.text().strip()
        pwd = self._pwd_in.text().strip()
        ch = self._ch_in.value()

        if not name or not ip:
            QMessageBox.warning(self, "Xato", "Nom va IP maydoni to'ldirilishi shart.")
            return
        if name in self.camera_widgets:
            QMessageBox.warning(self, "Xato", f"'{name}' nomli kamera allaqachon mavjud.")
            return

        cfg = {"name": name, "ip": ip, "username": user, "password": pwd, "channel": ch}
        self._start_camera(cfg)

        configs = self._load_config()
        configs.append(cfg)
        self._save_config(configs)

        self._refresh_grid()
        self._refresh_list()
        self._name_in.clear(); self._ip_in.clear()
        self._user_in.clear(); self._pwd_in.clear()
        self._ch_in.setValue(101)
        self._log(f"✅ Kamera qo'shildi: '{name}'")

    def _on_remove_camera(self):
        selected = self._cam_list.selectedItems()
        if not selected:
            QMessageBox.warning(self, "Tanlash kerak", "O'chirmoqchi bo'lgan kamerani tanlang.")
            return
        name = selected[0].text()
        reply = QMessageBox.question(self, "O'chirish",
            f"'{name}' kamerasini o'chirasizmi?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.No:
            return

        if name in self.recorders and self.recorders[name].is_recording():
            self.recorders[name].stop_recording()
            del self.recorders[name]

        self.hik_manager.remove_camera(name)

        if name in self.camera_widgets:
            self.camera_widgets[name].setParent(None)
            self.camera_widgets[name].deleteLater()
            del self.camera_widgets[name]

        configs = [c for c in self._load_config() if c["name"] != name]
        self._save_config(configs)
        self._refresh_grid()
        self._refresh_list()
        self._log(f"🗑  Kamera o'chirildi: '{name}'")

    # ── Grid / List refresh ──────────────────────────────────────────────────

    def _refresh_grid(self):
        for i in reversed(range(self._grid_layout.count())):
            item = self._grid_layout.itemAt(i)
            if item and item.widget():
                item.widget().setParent(None)

        n = len(self.camera_widgets)
        if n == 0:
            self._placeholder.show()
            self._grid_layout.addWidget(self._placeholder, 0, 0)
            return

        self._placeholder.hide()
        cols = 2 if n > 1 else 1
        for idx, (_, widget) in enumerate(self.camera_widgets.items()):
            self._grid_layout.addWidget(widget, idx // cols, idx % cols)

    def _refresh_list(self):
        self._cam_list.clear()
        self._cam_list.addItems(list(self.camera_widgets.keys()))

    # ── Config helpers ───────────────────────────────────────────────────────

    def _load_config(self) -> list:
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                self._log(f"Config yuklanmadi: {e}")
        default = [{
            "name": "Hikvision Main",
            "ip": "192.168.1.64",
            "username": "admin",
            "password": "kINGROOT888",
            "channel": 101,
        }]
        self._save_config(default)
        return default

    def _save_config(self, configs: list):
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(configs, f, indent=4, ensure_ascii=False)
        except Exception as e:
            self._log(f"Config saqlanmadi: {e}")

    # ── Logging ──────────────────────────────────────────────────────────────

    def _log(self, msg: str):
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        self._log_console.append(f"[{ts}] {msg}")
        logger.info(msg)

    # ── Cleanup ──────────────────────────────────────────────────────────────

    def closeEvent(self, event):
        self._log("Tizim yopilmoqda…")
        for name, rec in self.recorders.items():
            if rec.is_recording():
                rec.stop_recording()
        for name in list(self.camera_widgets.keys()):
            self.hik_manager.remove_camera(name)
        if self.bridge:
            self.bridge.shutdown()
        event.accept()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setApplicationName("Sentinel Biometrix")
    app.setOrganizationName("SentinelSystems")
    window = SentinelMainWindow()
    window.show()
    sys.exit(app.exec())
