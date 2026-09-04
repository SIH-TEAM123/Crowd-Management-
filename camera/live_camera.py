"""Live webcam-based crowd sensing using YOLO person tracking,

temporal smoothing, and configurable Region of Interest (ROI) filtering.
"""

from __future__ import annotations

import collections
import statistics
import time
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Ensure project root is in sys.path for direct CLI execution
_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import cv2
from ultralytics import YOLO

from camera.camera_config import CameraConfig, InputMode
from camera.camera_processor import CameraProcessor

# Default Region of Interest (normalized coordinates: xmin, ymin, xmax, ymax in [0.0, 1.0])
# Set roi_enabled=True in LiveCamera to constrain tracking to this zone.
DEFAULT_ROI: Tuple[float, float, float, float] = (0.1, 0.1, 0.9, 0.9)
DEFAULT_ROI_ENABLED: bool = False
DEFAULT_SMOOTHING_WINDOW: int = 5


class LiveCamera:
    """Live camera people sensing with ByteTrack persistent IDs,

    temporal smoothing, and optional ROI filtering.
    """

    def __init__(
        self,
        camera_index: int = 0,
        model_name: str = "yolo11n.pt",
        confidence_threshold: float = 0.40,
        smoothing_window: int = DEFAULT_SMOOTHING_WINDOW,
        roi: Optional[Tuple[float, float, float, float]] = DEFAULT_ROI,
        roi_enabled: bool = DEFAULT_ROI_ENABLED,
        processing_interval: float = 0.5,
        location_id: str = "HOSPITAL_001",
        camera_id: str = "CAMERA_01",
    ):
        """Initialize live camera detection and tracking.

        Args:
            camera_index: OpenCV VideoCapture device index.
            model_name: YOLO model weights file or identifier.
            confidence_threshold: Minimum confidence score for valid person detection.
            smoothing_window: Size of the rolling median window for count smoothing.
            roi: Region of Interest bounding box (xmin, ymin, xmax, ymax).
            roi_enabled: Whether to enforce ROI spatial filtering.
            processing_interval: Interval in seconds between consecutive inference passes.
            location_id: Facility/location identifier.
            camera_id: Camera identifier.
        """
        self.camera_index = camera_index
        self.model_name = model_name
        self.confidence_threshold = confidence_threshold
        self.smoothing_window = max(1, smoothing_window)
        self.count_history: collections.deque[int] = collections.deque(maxlen=self.smoothing_window)
        self.roi = roi
        self.roi_enabled = roi_enabled

        self.config = CameraConfig(
            location_id=location_id,
            camera_id=camera_id,
            input_mode=InputMode.LIVE_CAMERA,
            processing_interval=processing_interval,
        )
        self.processor = CameraProcessor(self.config)

        print(f"Loading YOLO tracking model: {model_name}")
        self.model = YOLO(model_name)
        print("YOLO tracking model loaded successfully.")

    def _is_inside_roi(self, cx: float, cy: float, frame_w: int, frame_h: int) -> bool:
        """Check if center coordinates (cx, cy) fall inside the ROI bounds."""
        if not self.roi_enabled or self.roi is None:
            return True

        rx1, ry1, rx2, ry2 = self.roi

        # Normalize or use pixel values
        if all(0.0 <= v <= 1.0 for v in (rx1, ry1, rx2, ry2)):
            px1, py1 = rx1 * frame_w, ry1 * frame_h
            px2, py2 = rx2 * frame_w, ry2 * frame_h
        else:
            px1, py1, px2, py2 = rx1, ry1, rx2, ry2

        xmin, xmax = min(px1, px2), max(px1, px2)
        ymin, ymax = min(py1, py2), max(py1, py2)

        return xmin <= cx <= xmax and ymin <= cy <= ymax

    def _draw_roi(self, frame: Any) -> None:
        """Draw the ROI boundary box and status label on the preview frame."""
        if not self.roi_enabled or self.roi is None or frame is None:
            return

        h, w = frame.shape[:2]
        rx1, ry1, rx2, ry2 = self.roi

        if all(0.0 <= v <= 1.0 for v in (rx1, ry1, rx2, ry2)):
            px1, py1 = int(rx1 * w), int(ry1 * h)
            px2, py2 = int(rx2 * w), int(ry2 * h)
        else:
            px1, py1, px2, py2 = int(rx1), int(ry1), int(rx2), int(ry2)

        xmin, xmax = min(px1, px2), max(px1, px2)
        ymin, ymax = min(py1, py2), max(py1, py2)

        cv2.rectangle(frame, (xmin, ymin), (xmax, ymax), (255, 200, 0), 2)
        cv2.putText(
            frame,
            "ROI Area",
            (xmin + 6, max(ymin + 18, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 200, 0),
            1,
            cv2.LINE_AA,
        )

    def smooth_count(self, raw_count: int) -> int:
        """Apply rolling median temporal smoothing to raw counts.

        Args:
            raw_count: Raw person count detected in the current frame.

        Returns:
            int: Smoothed stable person count.
        """
        self.count_history.append(raw_count)
        if not self.count_history:
            return 0
        return int(statistics.median_low(self.count_history))

    def detect_people(self, frame: Any) -> Tuple[List[Dict[str, Any]], int, int]:
        """Track people in a single frame using ByteTrack.

        Filters by class 0 (person), confidence threshold, valid track ID,
        and optional ROI spatial boundary.

        Args:
            frame: Raw BGR image matrix from camera.

        Returns:
            Tuple containing:
            - valid_detections: List of detection dictionaries for tracked people.
            - raw_count: Count of unique tracked persons inside ROI in this frame.
            - total_active_tracks: Total active tracked persons before ROI filtering.
        """
        if frame is None:
            return [], 0, 0

        fh, fw = frame.shape[:2]

        results = self.model.track(
            source=frame,
            persist=True,
            tracker="bytetrack.yaml",
            conf=self.confidence_threshold,
            classes=[0],
            verbose=False,
        )

        valid_detections: List[Dict[str, Any]] = []
        unique_track_ids = set()
        total_active_tracks = 0

        for result in results:
            if result.boxes is None or len(result.boxes) == 0:
                continue

            for box in result.boxes:
                # Validate person class
                cls_id = int(box.cls[0]) if box.cls is not None else 0
                if cls_id != 0:
                    continue

                # Validate confidence
                conf = float(box.conf[0]) if box.conf is not None else 0.0
                if conf < self.confidence_threshold:
                    continue

                # Check tracking ID
                track_id = int(box.id[0]) if (box.id is not None) else None
                if track_id is not None:
                    total_active_tracks += 1
                    if track_id in unique_track_ids:
                        # Prevent duplicate detections with the same track ID
                        continue

                # Check ROI bounding-box center
                xyxy = box.xyxy[0].tolist()
                cx = (xyxy[0] + xyxy[2]) / 2.0
                cy = (xyxy[1] + xyxy[3]) / 2.0

                if not self._is_inside_roi(cx, cy, fw, fh):
                    continue

                if track_id is not None:
                    unique_track_ids.add(track_id)

                valid_detections.append(
                    {
                        "class": "person",
                        "confidence": conf,
                        "track_id": track_id,
                    }
                )

        raw_count = len(unique_track_ids) if total_active_tracks > 0 else len(valid_detections)
        return valid_detections, raw_count, total_active_tracks

    def process_frame(
        self, frame: Any
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]], int, int]:
        """Process a frame: Track -> Filter ROI -> Smooth -> CameraProcessor.

        Args:
            frame: Camera frame to process.

        Returns:
            Tuple of (crowd_result, valid_detections, raw_count, stable_count).
        """
        valid_detections, raw_count, _total_active = self.detect_people(frame)
        stable_count = self.smooth_count(raw_count)

        # Build stable person detections for CameraProcessor
        stable_detections = [
            {"class": "person", "confidence": self.confidence_threshold}
            for _ in range(stable_count)
        ]

        crowd_result = self.processor.process_video(
            location_id=self.config.location_id,
            camera_id=self.config.camera_id,
            detections=stable_detections,
        )

        return crowd_result, valid_detections, raw_count, stable_count

    def read_once(self) -> Dict[str, Any]:
        """Capture and process a single webcam frame.

        Returns:
            Dict[str, Any]: Sanitized crowd telemetry result.
        """
        camera = cv2.VideoCapture(self.camera_index)
        if not camera.isOpened():
            raise RuntimeError(
                f"Unable to open camera index {self.camera_index}."
            )

        try:
            success, frame = camera.read()
            if not success or frame is None:
                raise RuntimeError(
                    "Camera opened successfully but no frame was received."
                )

            crowd_result, _, _, _ = self.process_frame(frame)
            return crowd_result
        finally:
            camera.release()

    def run(self, display: bool = True) -> None:
        """Continuously process webcam frames with live preview.

        Args:
            display: Whether to render the OpenCV GUI preview window.
        """
        camera = cv2.VideoCapture(self.camera_index)
        if not camera.isOpened():
            raise RuntimeError(
                f"Could not open camera index {self.camera_index}."
            )

        print()
        print("=" * 60)
        print("LIVE CAMERA CROWD SENSING")
        print("=" * 60)
        print("Detector    : YOLO + ByteTrack")
        print("Target      : person (COCO class 0)")
        print("Location    :", self.config.location_id)
        print("Camera      :", self.config.camera_id)
        print(f"Smoothing   : rolling median (window={self.smoothing_window})")
        roi_status = (
            f"ENABLED {self.roi}"
            if (self.roi_enabled and self.roi is not None)
            else "DISABLED (full-frame)"
        )
        print("ROI Filter  :", roi_status)
        print("Press Q or ESC to stop.")
        print("=" * 60)

        last_processed = 0.0
        raw_count = 0
        stable_count = 0
        active_tracks = 0

        try:
            while True:
                success, frame = camera.read()
                if not success or frame is None:
                    print("Failed to read camera frame.")
                    break

                now = time.monotonic()
                if now - last_processed >= self.config.processing_interval:
                    crowd_result, detections, raw_count, stable_count = self.process_frame(frame)
                    active_tracks = len(
                        {
                            d["track_id"]
                            for d in detections
                            if d.get("track_id") is not None
                        }
                    )
                    last_processed = now

                    print(
                        f"[{crowd_result['timestamp']}] "
                        f"Raw people detected: {raw_count} | "
                        f"Stable people count: {stable_count} | "
                        f"Active tracks: {active_tracks} | "
                        f"Location={crowd_result['location_id']} "
                        f"Camera={crowd_result['camera_id']} "
                        f"Source={crowd_result['source']}"
                    )

                if display:
                    display_frame = frame.copy()
                    self._draw_roi(display_frame)

                    cv2.putText(
                        display_frame,
                        f"People detected: {stable_count}",
                        (20, 35),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8,
                        (0, 255, 0),
                        2,
                        cv2.LINE_AA,
                    )

                    roi_label = "ON" if (self.roi_enabled and self.roi is not None) else "OFF"
                    cv2.putText(
                        display_frame,
                        f"Raw detections: {raw_count} | Active tracks: {active_tracks} | ROI: {roi_label}",
                        (20, 65),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.55,
                        (200, 255, 200),
                        1,
                        cv2.LINE_AA,
                    )

                    cv2.imshow(
                        "Crowd Management - Live Camera",
                        display_frame,
                    )

                    key = cv2.waitKey(1) & 0xFF
                    if key in (ord("q"), 27):
                        break

        except KeyboardInterrupt:
            print("\nCamera stopped by user.")
        finally:
            camera.release()
            if display:
                cv2.destroyAllWindows()
            print("Camera resources released.")


if __name__ == "__main__":
    LiveCamera().run()