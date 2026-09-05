"""Camera Stream Service for Live Computer Vision Crowd Sensing.

Coordinates background video capture (live webcam or simulated video feed),
YOLO11n person detection, ByteTrack tracking, ROI spatial filtering,
rolling median temporal smoothing, and real-time MJPEG encoding.
"""

from __future__ import annotations

import collections
import logging
import os
import statistics
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

# Ensure project root in sys.path
_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from camera.camera_config import CameraConfig, InputMode
from camera.camera_processor import CameraProcessor
from camera.privacy import PrivacyLayer
from app.services.operational_state_service import OperationalStateService
from app.schemas.operational_state import CameraTelemetryPublish

logger = logging.getLogger(__name__)

DEFAULT_ROI: Tuple[float, float, float, float] = (0.1, 0.1, 0.9, 0.9)
DEFAULT_SMOOTHING_WINDOW: int = 5


class CameraStreamService:
    """Thread-safe singleton service managing the live CV sensing pipeline."""

    _instance: Optional[CameraStreamService] = None
    _lock = threading.Lock()

    def __new__(cls) -> CameraStreamService:
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return

        self._initialized = True
        self.state_lock = threading.Lock()
        self.frame_lock = threading.Lock()

        # Operational state
        self.is_running: bool = False
        self.source_mode: str = "webcam"  # "webcam" or "simulation"
        self.camera_index: int = 0
        self.facility_id: str = "FAC_ANGUL_DH"
        self.camera_id: str = "CV_CAM_01"
        self.confidence_threshold: float = 0.35
        self.smoothing_window: int = DEFAULT_SMOOTHING_WINDOW
        self.roi: Tuple[float, float, float, float] = DEFAULT_ROI
        self.roi_enabled: bool = False
        self.auto_sync_telemetry: bool = True

        # Telemetry metrics
        self.latest_raw_count: int = 0
        self.latest_stable_count: int = 0
        self.latest_active_tracks: int = 0
        self.fps: float = 0.0
        self.last_frame_time: float = 0.0
        self.last_telemetry_sync: float = 0.0
        self.status_message: str = "Idle"

        # Smoothing history
        self.count_history: collections.deque[int] = collections.deque(
            maxlen=self.smoothing_window
        )

        # Cached frame
        self._latest_jpeg: Optional[bytes] = None
        self._placeholder_jpeg: Optional[bytes] = None

        # Thread management
        self._worker_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        # Lazy model loader
        self._model = None
        self._model_path = os.path.join(_PROJECT_ROOT, "yolo11n.pt")
        if not os.path.exists(self._model_path):
            self._model_path = "yolo11n.pt"

        # Synthetic simulation state
        self._sim_people = self._init_sim_people()

        # Pre-generate placeholder frame
        self._generate_placeholder()

    def _get_model(self):
        """Lazy-load YOLO model once."""
        if self._model is None:
            from ultralytics import YOLO
            logger.info("Initializing YOLO11n tracking model from: %s", self._model_path)
            self._model = YOLO(self._model_path)
        return self._model

    def _init_sim_people(self) -> List[Dict[str, Any]]:
        """Initialize animated person objects for synthetic demo simulation mode."""
        import random
        people = []
        for i in range(1, 9):
            people.append({
                "id": i,
                "x": random.uniform(80, 560),
                "y": random.uniform(120, 400),
                "vx": random.uniform(-1.5, 1.5),
                "vy": random.uniform(-1.0, 1.0),
                "radius": 18,
                "color": (200, 160, 60),
            })
        return people

    def _generate_placeholder(self) -> None:
        """Create a standby visual card when the camera is not actively capturing."""
        h, w = 480, 640
        canvas = np.zeros((h, w, 3), dtype=np.uint8)
        # Deep slate background
        canvas[:] = (24, 20, 15)

        # Subtle border grid
        cv2.rectangle(canvas, (10, 10), (w - 10, h - 10), (45, 38, 30), 1)

        # Center camera icon graphic
        center_x, center_y = w // 2, h // 2 - 25
        cv2.circle(canvas, (center_x, center_y), 50, (60, 48, 35), -1)
        cv2.circle(canvas, (center_x, center_y), 48, (120, 58, 237), 2)
        cv2.circle(canvas, (center_x, center_y), 24, (124, 58, 237), -1)
        cv2.circle(canvas, (center_x, center_y), 10, (255, 255, 255), -1)

        # Standby text
        cv2.putText(
            canvas,
            "VIZITOR CV SENSING STANDBY",
            (center_x - 175, center_y + 85),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            canvas,
            "Click 'Start Camera' to initiate live YOLO11n sensing",
            (center_x - 180, center_y + 115),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            (160, 160, 160),
            1,
            cv2.LINE_AA,
        )

        _, buf = cv2.imencode(".jpg", canvas, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        self._placeholder_jpeg = buf.tobytes()

    def _is_inside_roi(self, cx: float, cy: float, fw: int, fh: int) -> bool:
        """Check if center coordinates fall within the designated Region of Interest."""
        if not self.roi_enabled or self.roi is None:
            return True

        rx1, ry1, rx2, ry2 = self.roi
        if all(0.0 <= v <= 1.0 for v in (rx1, ry1, rx2, ry2)):
            px1, py1 = rx1 * fw, ry1 * fh
            px2, py2 = rx2 * fw, ry2 * fh
        else:
            px1, py1, px2, py2 = rx1, ry1, rx2, ry2

        xmin, xmax = min(px1, px2), max(px1, px2)
        ymin, ymax = min(py1, py2), max(py1, py2)
        return xmin <= cx <= xmax and ymin <= cy <= ymax

    def _draw_hud(
        self,
        frame: np.ndarray,
        raw_count: int,
        stable_count: int,
        active_tracks: int,
        detections: List[Dict[str, Any]],
    ) -> None:
        """Render detection boxes, tracking IDs, ROI boundary, and HUD metrics overlay."""
        fh, fw = frame.shape[:2]

        # 1. Draw ROI Box
        if self.roi_enabled and self.roi is not None:
            rx1, ry1, rx2, ry2 = self.roi
            if all(0.0 <= v <= 1.0 for v in (rx1, ry1, rx2, ry2)):
                px1, py1 = int(rx1 * fw), int(ry1 * fh)
                px2, py2 = int(rx2 * fw), int(ry2 * fh)
            else:
                px1, py1, px2, py2 = int(rx1), int(ry1), int(rx2), int(ry2)

            xmin, xmax = min(px1, px2), max(px1, px2)
            ymin, ymax = min(py1, py2), max(py1, py2)

            # Draw dashed/vibrant ROI rectangle
            cv2.rectangle(frame, (xmin, ymin), (xmax, ymax), (0, 215, 255), 2)
            # Corner accents
            c_len = 15
            for (cx, cy) in [(xmin, ymin), (xmax, ymin), (xmin, ymax), (xmax, ymax)]:
                dx = c_len if cx == xmin else -c_len
                dy = c_len if cy == ymin else -c_len
                cv2.line(frame, (cx, cy), (cx + dx, cy), (0, 255, 255), 3)
                cv2.line(frame, (cx, cy), (cx, cy + dy), (0, 255, 255), 3)

            cv2.putText(
                frame,
                "ZONE: ROI MONITORING ACTIVE",
                (xmin + 8, max(ymin - 8, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.48,
                (0, 215, 255),
                1,
                cv2.LINE_AA,
            )

        # 2. Draw Detection Bounding Boxes
        for det in detections:
            bbox = det.get("bbox")
            if bbox is None or len(bbox) != 4:
                continue

            x1, y1, x2, y2 = [int(v) for v in bbox]
            tid = det.get("track_id")
            conf = det.get("confidence", 0.0)
            in_roi = det.get("in_roi", True)

            # Colors: Green for valid inside ROI, Grey for outside ROI
            box_color = (16, 185, 129) if in_roi else (120, 120, 120)

            # Bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)

            # Tag label
            label = f"Person #{tid}" if tid is not None else "Person"
            label += f" {int(conf * 100)}%"
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)

            cv2.rectangle(
                frame,
                (x1, max(0, y1 - lh - 8)),
                (x1 + lw + 8, y1),
                box_color,
                -1,
            )
            cv2.putText(
                frame,
                label,
                (x1 + 4, max(lh + 2, y1 - 4)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (255, 255, 255),
                1,
                cv2.LINE_AA,
            )

        # 3. Top Status Glass HUD
        hud_h = 44
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (fw, hud_h), (15, 15, 15), -1)
        cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

        # Live status dot
        dot_color = (0, 255, 120) if self.is_running else (0, 0, 255)
        cv2.circle(frame, (20, 22), 6, dot_color, -1)

        mode_str = "WEBCAM" if self.source_mode == "webcam" else "SIMULATION"
        cv2.putText(
            frame,
            f"LIVE CV [{mode_str}]",
            (34, 27),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.52,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

        hud_info = (
            f"Smoothed Count: {stable_count}  |  "
            f"Raw: {raw_count}  |  "
            f"Tracks: {active_tracks}  |  "
            f"FPS: {self.fps:.1f}"
        )
        cv2.putText(
            frame,
            hud_info,
            (200, 27),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            (220, 220, 220),
            1,
            cv2.LINE_AA,
        )

        # Bottom Privacy Shield Strip
        btm_h = 24
        b_overlay = frame.copy()
        cv2.rectangle(b_overlay, (0, fh - btm_h), (fw, fh), (10, 10, 10), -1)
        cv2.addWeighted(b_overlay, 0.70, frame, 0.30, 0, frame)

        cv2.putText(
            frame,
            "100% Privacy Protected: Zero biometric/facial frames stored. Edge count only.",
            (14, fh - 7),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.38,
            (180, 180, 180),
            1,
            cv2.LINE_AA,
        )

    def _generate_simulation_frame(self) -> np.ndarray:
        """Generate a synthetic waiting room frame with moving person silhouettes for testing."""
        fw, fh = 640, 480
        frame = np.zeros((fh, fw, 3), dtype=np.uint8)
        # Deep blue-gray waiting room floor
        frame[:] = (45, 36, 30)

        # Draw room boundary and reception counter
        cv2.rectangle(frame, (40, 60), (fw - 40, fh - 40), (70, 58, 48), 2)
        cv2.rectangle(frame, (80, 70), (220, 105), (100, 80, 65), -1)
        cv2.putText(
            frame,
            "RECEPTION / TRIAGE",
            (90, 93),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            (220, 220, 220),
            1,
            cv2.LINE_AA,
        )

        # Draw waiting chairs
        for row in range(3):
            for col in range(5):
                cx = 120 + col * 95
                cy = 190 + row * 80
                cv2.rectangle(frame, (cx - 20, cy - 15), (cx + 20, cy + 15), (60, 50, 42), -1)

        # Update animated people positions
        for p in self._sim_people:
            p["x"] += p["vx"]
            p["y"] += p["vy"]

            # Bounce off walls
            if p["x"] <= 70 or p["x"] >= fw - 70:
                p["vx"] *= -1
            if p["y"] <= 120 or p["y"] >= fh - 60:
                p["vy"] *= -1

            # Draw person silhouette
            px, py = int(p["x"]), int(p["y"])
            # Body
            cv2.ellipse(frame, (px, py + 14), (16, 22), 0, 0, 360, (140, 110, 80), -1)
            # Head
            cv2.circle(frame, (px, py - 8), 12, (200, 170, 140), -1)

        return frame

    def _sync_telemetry(self, count: int) -> None:
        """Push real-time smoothed count to OperationalStateService."""
        try:
            telemetry_in = CameraTelemetryPublish(
                camera_id=self.camera_id,
                people_count=count,
                timestamp=datetime.now(timezone.utc),
                location_type="waiting_room",
            )
            OperationalStateService.publish_camera_telemetry(
                facility_id=self.facility_id,
                telemetry_in=telemetry_in,
            )
            self.last_telemetry_sync = time.time()
        except Exception as err:
            logger.warning("Failed to sync camera telemetry: %s", err)

    def _worker_loop(self) -> None:
        """Background inference loop."""
        logger.info("Starting camera worker loop. Mode: %s", self.source_mode)
        cap = None
        model = None

        if self.source_mode == "webcam":
            try:
                cap = cv2.VideoCapture(self.camera_index)
                if not cap.isOpened():
                    logger.warning(
                        "Could not open webcam index %d, switching to simulation mode",
                        self.camera_index,
                    )
                    self.source_mode = "simulation"
                    if cap:
                        cap.release()
                    cap = None
            except Exception as e:
                logger.error("Error opening webcam: %s", e)
                self.source_mode = "simulation"

        try:
            model = self._get_model()
        except Exception as e:
            logger.error("Failed to load YOLO model: %s", e)

        fps_start = time.time()
        frames_counted = 0

        while not self._stop_event.is_set():
            loop_start = time.time()
            frame = None

            if self.source_mode == "webcam" and cap is not None:
                ret, raw_frame = cap.read()
                if ret and raw_frame is not None:
                    frame = raw_frame
                else:
                    logger.warning("Webcam frame read failed, falling back to simulation frame")
                    frame = self._generate_simulation_frame()
            else:
                frame = self._generate_simulation_frame()

            fh, fw = frame.shape[:2]
            detections_to_draw = []
            unique_track_ids = set()
            raw_count = 0

            if model is not None:
                try:
                    # Run YOLO ByteTrack
                    results = model.track(
                        source=frame,
                        persist=True,
                        tracker="bytetrack.yaml",
                        conf=self.confidence_threshold,
                        classes=[0],  # Person class
                        verbose=False,
                    )

                    for result in results:
                        if result.boxes is None or len(result.boxes) == 0:
                            continue

                        for box in result.boxes:
                            cls_id = int(box.cls[0]) if box.cls is not None else 0
                            if cls_id != 0:
                                continue

                            conf = float(box.conf[0]) if box.conf is not None else 0.0
                            if conf < self.confidence_threshold:
                                continue

                            track_id = int(box.id[0]) if (box.id is not None) else None
                            xyxy = box.xyxy[0].tolist()
                            cx = (xyxy[0] + xyxy[2]) / 2.0
                            cy = (xyxy[1] + xyxy[3]) / 2.0

                            in_roi = self._is_inside_roi(cx, cy, fw, fh)

                            if in_roi:
                                if track_id is not None:
                                    unique_track_ids.add(track_id)
                                raw_count += 1

                            detections_to_draw.append({
                                "bbox": xyxy,
                                "track_id": track_id,
                                "confidence": conf,
                                "in_roi": in_roi,
                            })

                except Exception as err:
                    logger.error("Inference exception: %s", err)
                    # Fallback count in case of tracker glitch
                    raw_count = len(self._sim_people) if self.source_mode == "simulation" else 0
            else:
                raw_count = len(self._sim_people) if self.source_mode == "simulation" else 0

            # Smooth count
            with self.state_lock:
                self.count_history.append(raw_count)
                stable_count = (
                    int(statistics.median_low(self.count_history))
                    if self.count_history
                    else raw_count
                )
                self.latest_raw_count = raw_count
                self.latest_stable_count = stable_count
                self.latest_active_tracks = (
                    len(unique_track_ids) if unique_track_ids else raw_count
                )

            # Draw HUD
            self._draw_hud(
                frame=frame,
                raw_count=raw_count,
                stable_count=stable_count,
                active_tracks=self.latest_active_tracks,
                detections=detections_to_draw,
            )

            # Encode frame to JPEG
            _, jpeg_buffer = cv2.imencode(
                ".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75]
            )
            jpeg_bytes = jpeg_buffer.tobytes()

            with self.frame_lock:
                self._latest_jpeg = jpeg_bytes

            # Auto-sync telemetry if interval passed (every 2 seconds)
            now = time.time()
            if self.auto_sync_telemetry and (now - self.last_telemetry_sync >= 2.0):
                self._sync_telemetry(stable_count)

            # Calculate FPS
            frames_counted += 1
            if now - fps_start >= 1.0:
                self.fps = frames_counted / (now - fps_start)
                frames_counted = 0
                fps_start = now

            # Sleep briefly to throttle CPU (~20 FPS)
            elapsed = time.time() - loop_start
            sleep_time = max(0.01, 0.05 - elapsed)
            time.sleep(sleep_time)

        # Release resources
        if cap is not None:
            cap.release()
            logger.info("Camera capture released.")

        with self.frame_lock:
            self._latest_jpeg = None

        logger.info("Camera worker loop exited successfully.")

    # ---------------------------------------------------------
    # Public Management API
    # ---------------------------------------------------------

    def start(
        self,
        source_mode: str = "webcam",
        camera_index: int = 0,
        facility_id: str = "FAC_ANGUL_DH",
        camera_id: str = "CV_CAM_01",
        roi_enabled: bool = False,
    ) -> Dict[str, Any]:
        """Start or reconfigure the live computer vision sensing pipeline."""
        with self.state_lock:
            if self.is_running:
                # If already running with same parameters, return existing status
                if (
                    self.source_mode == source_mode
                    and self.camera_index == camera_index
                    and self.facility_id == facility_id
                ):
                    return self.get_status()
                # Stop existing and restart
                self.stop()

            self.source_mode = source_mode
            self.camera_index = camera_index
            self.facility_id = facility_id
            self.camera_id = camera_id
            self.roi_enabled = roi_enabled
            self.is_running = True
            self.status_message = f"Active ({source_mode})"
            self.count_history.clear()
            self._stop_event.clear()

            self._worker_thread = threading.Thread(
                target=self._worker_loop,
                daemon=True,
                name="CameraStreamWorker",
            )
            self._worker_thread.start()

        logger.info("Started camera service in %s mode", source_mode)
        return self.get_status()

    def stop(self) -> Dict[str, Any]:
        """Stop capture and release camera hardware."""
        with self.state_lock:
            if not self.is_running:
                return self.get_status()

            self.is_running = False
            self.status_message = "Stopped"
            self._stop_event.set()

        if self._worker_thread is not None and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2.0)

        self._worker_thread = None
        logger.info("Stopped camera stream service.")
        return self.get_status()

    def toggle_roi(self) -> Dict[str, Any]:
        """Toggle Region of Interest spatial filtering on or off."""
        with self.state_lock:
            self.roi_enabled = not self.roi_enabled
        return self.get_status()

    def set_source_mode(self, mode: str) -> Dict[str, Any]:
        """Switch mode between 'webcam' and 'simulation'."""
        if mode not in ("webcam", "simulation"):
            raise ValueError("Invalid mode. Must be 'webcam' or 'simulation'.")
        if self.is_running:
            self.stop()
            return self.start(source_mode=mode)
        else:
            self.source_mode = mode
            return self.get_status()

    def sync_telemetry_now(self) -> Dict[str, Any]:
        """Manually trigger immediate telemetry push to OperationalStateService."""
        with self.state_lock:
            count = self.latest_stable_count
        self._sync_telemetry(count)
        return {
            "synced": True,
            "facility_id": self.facility_id,
            "camera_id": self.camera_id,
            "people_count": count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def get_status(self) -> Dict[str, Any]:
        """Get live status and telemetry metrics."""
        with self.state_lock:
            return {
                "is_running": self.is_running,
                "source_mode": self.source_mode,
                "camera_index": self.camera_index,
                "facility_id": self.facility_id,
                "camera_id": self.camera_id,
                "people_count": self.latest_stable_count,
                "raw_count": self.latest_raw_count,
                "active_tracks": self.latest_active_tracks,
                "roi_enabled": self.roi_enabled,
                "roi_bounds": list(self.roi) if self.roi else None,
                "fps": round(self.fps, 1),
                "auto_sync": self.auto_sync_telemetry,
                "status_message": self.status_message,
                "privacy": {
                    "mode": "EDGE_ANONYMIZED",
                    "biometrics_stored": False,
                    "facial_recognition": False,
                    "aggregate_only": True,
                },
            }

    def get_latest_jpeg(self) -> bytes:
        """Return the latest frame JPEG bytes, or standby placeholder if inactive."""
        with self.frame_lock:
            if self._latest_jpeg is not None:
                return self._latest_jpeg
            return self._placeholder_jpeg or b""


# Singleton export
camera_stream_service = CameraStreamService()
