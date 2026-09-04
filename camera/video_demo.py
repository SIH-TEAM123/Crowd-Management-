"""Pre-recorded Video Demonstration Mode for Crowd Sensing.

Processes a local video file frame-by-frame using YOLO11n person detection,
ByteTrack persistent ID tracking, configurable ROI spatial filtering,
and rolling median temporal smoothing.
"""

from __future__ import annotations

import argparse
import collections
import math
import os
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

DEFAULT_ROI: Tuple[float, float, float, float] = (0.1, 0.1, 0.9, 0.9)
DEFAULT_ROI_ENABLED: bool = False
DEFAULT_SMOOTHING_WINDOW: int = 5


class VideoDemo:
    """Demonstration processor for pre-recorded video files."""

    def __init__(
        self,
        video_path: str,
        model_name: str = "yolo11n.pt",
        confidence_threshold: float = 0.40,
        smoothing_window: int = DEFAULT_SMOOTHING_WINDOW,
        roi: Optional[Tuple[float, float, float, float]] = DEFAULT_ROI,
        roi_enabled: bool = DEFAULT_ROI_ENABLED,
        location_id: str = "DEMO_HOSPITAL_001",
        camera_id: str = "DEMO_VIDEO_01",
    ):
        """Initialize VideoDemo with a verified video file path.

        Args:
            video_path: Path to the local video file.
            model_name: YOLO model file or identifier.
            confidence_threshold: Minimum confidence score for person detection.
            smoothing_window: Number of samples in rolling median window.
            roi: Region of Interest coordinates (xmin, ymin, xmax, ymax).
            roi_enabled: Whether to filter person detections by ROI.
            location_id: Location identifier for telemetry.
            camera_id: Camera identifier for telemetry.

        Raises:
            ValueError: If video_path is empty or invalid.
            FileNotFoundError: If the specified video file does not exist.
            RuntimeError: If OpenCV cannot open the video file.
        """
        if not video_path or not isinstance(video_path, (str, os.PathLike)):
            raise ValueError("A valid video file path string must be provided.")

        video_path_str = str(video_path)

        if not os.path.exists(video_path_str):
            raise FileNotFoundError(f"Video file does not exist: '{video_path_str}'")

        if not os.path.isfile(video_path_str):
            raise ValueError(f"Path is not a regular file: '{video_path_str}'")

        # Test video file accessibility with OpenCV
        test_cap = cv2.VideoCapture(video_path_str)
        if not test_cap.isOpened():
            test_cap.release()
            raise RuntimeError(
                f"OpenCV was unable to open or decode video file: '{video_path_str}'"
            )
        test_cap.release()

        self.video_path = video_path_str
        self.model_name = model_name
        self.confidence_threshold = confidence_threshold
        self.smoothing_window = max(1, smoothing_window)
        self.count_history: collections.deque[int] = collections.deque(maxlen=self.smoothing_window)
        self.roi = roi
        self.roi_enabled = roi_enabled

        self.config = CameraConfig(
            location_id=location_id,
            camera_id=camera_id,
            input_mode=InputMode.VIDEO,
            processing_interval=1.0,
        )
        self.processor = CameraProcessor(self.config)

        print(f"Loading YOLO tracking model for video demo: {model_name}")
        self.model = YOLO(model_name)
        print("YOLO tracking model loaded successfully.")

    def _is_inside_roi(self, cx: float, cy: float, frame_w: int, frame_h: int) -> bool:
        """Check if center coordinates (cx, cy) fall inside the ROI bounds."""
        if not self.roi_enabled or self.roi is None:
            return True

        rx1, ry1, rx2, ry2 = self.roi

        if all(0.0 <= v <= 1.0 for v in (rx1, ry1, rx2, ry2)):
            px1, py1 = rx1 * frame_w, ry1 * frame_h
            px2, py2 = rx2 * frame_w, ry2 * frame_h
        else:
            px1, py1, px2, py2 = rx1, ry1, rx2, ry2

        xmin, xmax = min(px1, px2), max(px1, px2)
        ymin, ymax = min(py1, py2), max(py1, py2)

        return xmin <= cx <= xmax and ymin <= cy <= ymax

    def _draw_roi(self, frame: Any) -> None:
        """Draw ROI boundary on the preview frame."""
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
        """Apply rolling median temporal smoothing to raw counts."""
        self.count_history.append(raw_count)
        if not self.count_history:
            return 0
        return int(statistics.median_low(self.count_history))

    def detect_people(self, frame: Any) -> Tuple[List[Dict[str, Any]], int, int]:
        """Track people in a single frame using ByteTrack.

        Returns:
            Tuple of (valid_detections, raw_count, total_active_tracks).
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
                cls_id = int(box.cls[0]) if box.cls is not None else 0
                if cls_id != 0:
                    continue

                conf = float(box.conf[0]) if box.conf is not None else 0.0
                if conf < self.confidence_threshold:
                    continue

                track_id = int(box.id[0]) if (box.id is not None) else None
                if track_id is not None:
                    total_active_tracks += 1
                    if track_id in unique_track_ids:
                        continue

                xyxy = box.xyxy[0].tolist()
                x1, y1, x2, y2 = [int(v) for v in xyxy]
                cx = (x1 + x2) / 2.0
                cy = (y1 + y2) / 2.0

                if not self._is_inside_roi(cx, cy, fw, fh):
                    continue

                if track_id is not None:
                    unique_track_ids.add(track_id)

                valid_detections.append(
                    {
                        "class": "person",
                        "confidence": conf,
                        "track_id": track_id,
                        "bbox": (x1, y1, x2, y2),
                    }
                )

        raw_count = len(unique_track_ids) if total_active_tracks > 0 else len(valid_detections)
        return valid_detections, raw_count, total_active_tracks

    def process_frame(
        self, frame: Any
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]], int, int]:
        """Process a single frame through tracking, ROI filtering, smoothing, and CameraProcessor."""
        valid_detections, raw_count, _total_active = self.detect_people(frame)
        stable_count = self.smooth_count(raw_count)

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

    def run(self, display: bool = True, max_frames: Optional[int] = None) -> Tuple[int, Dict[str, Any]]:
        """Run the pre-recorded video demonstration loop.

        Args:
            display: Whether to show the OpenCV preview window.
            max_frames: Optional maximum number of frames to process.

        Returns:
            Tuple of (total_frames_processed, last_crowd_result).
        """
        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Unable to open video: {self.video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0 or math.isnan(fps):
            fps = 30.0
        frame_delay_ms = max(1, int(1000.0 / fps))

        total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        print()
        print("=" * 60)
        print("PRE-RECORDED VIDEO DEMONSTRATION MODE")
        print("=" * 60)
        print("Source Video:", self.video_path)
        print(f"Total Frames: {total_video_frames} | Video FPS: {fps:.2f}")
        print("Detector    : YOLO11n + ByteTrack")
        print("Target      : person (COCO class 0)")
        print("Location    :", self.config.location_id)
        print("Camera      :", self.config.camera_id)
        print(f"Smoothing   : rolling median (window={self.smoothing_window})")
        roi_status = f"ENABLED {self.roi}" if (self.roi_enabled and self.roi is not None) else "DISABLED"
        print("ROI Filter  :", roi_status)
        print("Press Q or ESC to stop playback.")
        print("=" * 60)

        frames_processed = 0
        last_crowd_result = {
            "location_id": self.config.location_id,
            "camera_id": self.config.camera_id,
            "people_count": 0,
            "source": "video",
        }

        try:
            while True:
                if max_frames is not None and frames_processed >= max_frames:
                    break

                success, frame = cap.read()
                if not success or frame is None:
                    print("\nEnd of video stream reached.")
                    break

                frames_processed += 1
                crowd_result, detections, raw_count, stable_count = self.process_frame(frame)
                last_crowd_result = crowd_result

                active_tracks = len(
                    {
                        d["track_id"]
                        for d in detections
                        if d.get("track_id") is not None
                    }
                )

                if frames_processed % 15 == 0 or frames_processed == 1:
                    print(
                        f"[Frame {frames_processed}/{total_video_frames or '?'}] "
                        f"Raw people: {raw_count} | "
                        f"Stable count: {stable_count} | "
                        f"Active tracks: {active_tracks} | "
                        f"Source={crowd_result['source']}"
                    )

                if display:
                    display_frame = frame.copy()

                    # 1. Draw ROI
                    self._draw_roi(display_frame)

                    # 2. Draw bounding boxes & tracking IDs
                    for det in detections:
                        x1, y1, x2, y2 = det.get("bbox", (0, 0, 0, 0))
                        tid = det.get("track_id")
                        conf = det.get("confidence", 0.0)

                        cv2.rectangle(display_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        label = f"ID:{tid} ({conf:.2f})" if tid is not None else f"Person ({conf:.2f})"
                        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
                        cv2.rectangle(
                            display_frame,
                            (x1, max(0, y1 - th - 6)),
                            (x1 + tw + 4, y1),
                            (0, 255, 0),
                            -1,
                        )
                        cv2.putText(
                            display_frame,
                            label,
                            (x1 + 2, y1 - 4),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.45,
                            (0, 0, 0),
                            1,
                            cv2.LINE_AA,
                        )

                    # 3. Draw HUD
                    # Header badge
                    cv2.rectangle(display_frame, (10, 10), (330, 40), (40, 40, 40), -1)
                    cv2.putText(
                        display_frame,
                        "SOURCE: DEMO VIDEO",
                        (20, 32),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.65,
                        (0, 215, 255),
                        2,
                        cv2.LINE_AA,
                    )

                    # Count info
                    cv2.putText(
                        display_frame,
                        f"People detected: {stable_count}",
                        (20, 70),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.85,
                        (0, 255, 0),
                        2,
                        cv2.LINE_AA,
                    )

                    roi_label = "ON" if (self.roi_enabled and self.roi is not None) else "OFF"
                    cv2.putText(
                        display_frame,
                        f"Raw people: {raw_count} | Active tracks: {active_tracks} | ROI: {roi_label}",
                        (20, 100),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.55,
                        (200, 255, 200),
                        1,
                        cv2.LINE_AA,
                    )

                    cv2.imshow("Crowd Management - Video Demo", display_frame)

                    key = cv2.waitKey(frame_delay_ms) & 0xFF
                    if key in (ord("q"), 27):
                        print("\nVideo playback stopped by user.")
                        break

        except KeyboardInterrupt:
            print("\nVideo playback interrupted by user.")
        finally:
            cap.release()
            if display:
                cv2.destroyAllWindows()
            print("Video demo resources cleanly released.")

        return frames_processed, last_crowd_result


def main():
    """Command-line entrypoint for running the video demonstration."""
    parser = argparse.ArgumentParser(
        description="SIH Crowd Management - Video Demonstration Mode"
    )
    parser.add_argument(
        "--video",
        "-v",
        required=True,
        type=str,
        help="Path to the pre-recorded video file (e.g. queue_demo.mp4)",
    )
    parser.add_argument(
        "--model",
        default="yolo11n.pt",
        type=str,
        help="YOLO model path/identifier (default: yolo11n.pt)",
    )
    parser.add_argument(
        "--conf",
        default=0.40,
        type=float,
        help="Confidence threshold for person detection (default: 0.40)",
    )
    parser.add_argument(
        "--smoothing",
        default=DEFAULT_SMOOTHING_WINDOW,
        type=int,
        help="Rolling median smoothing window size (default: 5)",
    )
    parser.add_argument(
        "--roi",
        action="store_true",
        help="Enable Region of Interest (ROI) filtering",
    )
    parser.add_argument(
        "--no-display",
        action="store_true",
        help="Run without opening GUI window (headless/benchmark)",
    )

    args = parser.parse_args()

    try:
        demo = VideoDemo(
            video_path=args.video,
            model_name=args.model,
            confidence_threshold=args.conf,
            smoothing_window=args.smoothing,
            roi_enabled=args.roi,
        )
        demo.run(display=not args.no_display)
    except Exception as e:
        print(f"\n[ERROR] Video Demo failed: {e}")


if __name__ == "__main__":
    main()
