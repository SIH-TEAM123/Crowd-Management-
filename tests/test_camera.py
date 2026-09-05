"""Comprehensive unit tests for the software camera sensing layer and Person 4 integration."""

from datetime import datetime, timezone
import pytest

import numpy as np
import cv2

from camera import (
    CameraConfig,
    CameraProcessor,
    InputMode,
    LiveCamera,
    VideoDemo,
    PeopleCounter,
    PrivacyLayer,
    camera_count_to_operational_state,
    generate_utc_timestamp
)
from models.input_models import CurrentOperationalState, OptimizationInput, Prediction, ResourceState, PriorityInfo, CongestionLevel


def test_simulation_zero_people():
    """1. Simulation with 0 people."""
    processor = CameraProcessor()
    result = processor.process_simulation(people_count=0)
    assert result["people_count"] == 0


def test_simulation_one_person():
    """2. Simulation with 1 person."""
    processor = CameraProcessor()
    result = processor.process_simulation(people_count=1)
    assert result["people_count"] == 1


def test_simulation_50_people():
    """3. Simulation with 50 people."""
    processor = CameraProcessor()
    result = processor.process_simulation(people_count=50)
    assert result["people_count"] == 50


def test_simulation_100_people():
    """4. Simulation with 100 people."""
    processor = CameraProcessor()
    result = processor.process_simulation(people_count=100)
    assert result["people_count"] == 100


def test_negative_count_rejected():
    """5. Negative count rejected."""
    with pytest.raises(ValueError, match="cannot be negative"):
        PeopleCounter.count_simulated(-1)

    processor = CameraProcessor()
    with pytest.raises(ValueError):
        processor.process_simulation(people_count=-5)


def test_invalid_count_type_rejected():
    """6. Invalid count type rejected (string, float, etc.)."""
    with pytest.raises(TypeError):
        PeopleCounter.count_simulated("73")

    with pytest.raises(TypeError):
        PeopleCounter.count_simulated(12.5)

    with pytest.raises(TypeError):
        PeopleCounter.count_simulated(None)


def test_bool_count_rejected():
    """Bool being rejected as a count (in Python bool is a subclass of int)."""
    with pytest.raises(TypeError, match="boolean"):
        PeopleCounter.count_simulated(True)

    with pytest.raises(TypeError, match="boolean"):
        PeopleCounter.count_simulated(False)


def test_detection_list_counting():
    """7. Detection list containing people counts correctly."""
    detections = [
        {"class": "person"},
        {"category": "person"},
        {"label": "PERSON"},
        "Person"
    ]
    count = PeopleCounter.count_detections(detections)
    assert count == 4


def test_non_person_objects_ignored():
    """8. Non-person objects are ignored."""
    detections = [
        {"class": "person"},
        {"class": "car"},
        {"category": "chair"},
        {"label": "dog"},
        "vehicle",
        "person"
    ]
    count = PeopleCounter.count_detections(detections)
    assert count == 2


def test_case_insensitive_person_label():
    """Case-insensitive person label checking."""
    detections = ["PERSON", "Person", "person", "PeRsOn"]
    assert PeopleCounter.count_detections(detections) == 4


def test_empty_detection_list():
    """Empty or None detection list."""
    assert PeopleCounter.count_detections([]) == 0
    assert PeopleCounter.count_detections(None) == 0


def test_invalid_detection_objects():
    """Invalid objects in detection list handling."""
    detections = [None, 123, {"class": None}, {}, {"other_key": "value"}, "person"]
    assert PeopleCounter.count_detections(detections) == 1


def test_privacy_layer_strips_identity_fields():
    """9. Privacy layer strips identity fields."""
    raw_data = {
        "location_id": "HOSPITAL_001",
        "camera_id": "CAM_01",
        "people_count": 42,
        "timestamp": "2026-08-26T20:00:00Z",
        "source": "simulation",
        "face": "binary_data",
        "face_id": "FID_123",
        "embedding": [0.1, 0.2, 0.3],
        "name": "John Doe",
        "person_id": "PID_999",
        "identity": "admin",
        "tracking_id": "TRK_001"
    }
    sanitized = PrivacyLayer.sanitize_crowd_data(raw_data)

    assert "face" not in sanitized
    assert "face_id" not in sanitized
    assert "embedding" not in sanitized
    assert "name" not in sanitized
    assert "person_id" not in sanitized
    assert "identity" not in sanitized
    assert "tracking_id" not in sanitized
    assert sanitized["people_count"] == 42
    assert PrivacyLayer.is_privacy_compliant(sanitized) is True


def test_privacy_layer_strips_image_frame_data():
    """10. Privacy layer does not expose image/frame data."""
    raw_data = {
        "location_id": "CLINIC_002",
        "camera_id": "CAM_02",
        "people_count": 15,
        "timestamp": "2026-08-26T20:00:00Z",
        "source": "simulation",
        "image": "raw_jpeg_bytes",
        "frame": "frame_matrix",
        "bounding_box": [10, 20, 100, 200]
    }
    sanitized = PrivacyLayer.sanitize_crowd_data(raw_data)

    assert "image" not in sanitized
    assert "frame" not in sanitized
    assert "bounding_box" not in sanitized
    assert len(sanitized) == 5
    assert set(sanitized.keys()) == {"location_id", "camera_id", "people_count", "timestamp", "source"}


def test_nested_sensitive_data_not_leaking():
    """Nested sensitive data does not leak into output."""
    raw_data = {
        "location_id": "HOSPITAL_001",
        "camera_id": "CAM_01",
        "people_count": 10,
        "timestamp": "2026-08-26T20:00:00Z",
        "source": "simulation",
        "identities": [{"name": "Alice", "embedding": [1, 2, 3]}],
        "images": ["img1.jpg", "img2.jpg"]
    }
    sanitized = PrivacyLayer.sanitize_crowd_data(raw_data)

    assert "identities" not in sanitized
    assert "images" not in sanitized
    assert set(sanitized.keys()) == {"location_id", "camera_id", "people_count", "timestamp", "source"}


def test_simulation_mode_without_hardware():
    """11. Simulation mode works without camera hardware."""
    processor = CameraProcessor()
    result = processor.process_simulation(
        location_id="HOSPITAL_001",
        camera_id="CAMERA_01",
        people_count=73
    )

    assert result["location_id"] == "HOSPITAL_001"
    assert result["camera_id"] == "CAMERA_01"
    assert result["people_count"] == 73
    assert result["source"] == "simulation"


def test_camera_reserved_no_hardware_access():
    """12. CAMERA_RESERVED does not attempt hardware access."""
    processor = CameraProcessor(config=CameraConfig(input_mode=InputMode.CAMERA_RESERVED))
    result = processor.process()

    assert result["status"] == "hardware integration not configured"
    assert result["hardware_configured"] is False
    assert result["source"] == "camera_reserved"


def test_crowd_result_has_location_id():
    """13. Crowd result has location_id."""
    processor = CameraProcessor()
    result = processor.process_simulation(location_id="LOC_XYZ", people_count=5)
    assert result["location_id"] == "LOC_XYZ"


def test_crowd_result_has_camera_id():
    """14. Crowd result has camera_id."""
    processor = CameraProcessor()
    result = processor.process_simulation(camera_id="CAM_99", people_count=5)
    assert result["camera_id"] == "CAM_99"


def test_crowd_result_has_timestamp():
    """15. Crowd result has timestamp."""
    processor = CameraProcessor()
    result = processor.process_simulation(people_count=5)
    assert "timestamp" in result
    assert isinstance(result["timestamp"], str)
    assert len(result["timestamp"]) > 0


def test_timezone_aware_timestamp():
    """Generated timestamp is timezone-aware ISO-8601 string."""
    ts_str = generate_utc_timestamp()
    dt = datetime.fromisoformat(ts_str)
    assert dt.tzinfo is not None
    assert dt.tzinfo == timezone.utc


def test_person4_integration_accepts_crowd_count():
    """16. Person 4 integration accepts the crowd count correctly."""
    processor = CameraProcessor()
    crowd_result = processor.process_simulation(
        location_id="HOSPITAL_001",
        camera_id="CAMERA_01",
        people_count=73
    )

    operational_state = camera_count_to_operational_state(crowd_result)

    assert isinstance(operational_state, CurrentOperationalState)
    assert operational_state.queue_length == 73

    # Now verify complete OptimizationInput construction with this operational state
    opt_input = OptimizationInput(
        facility_id="HOSPITAL_001",
        institution_type="General Hospital",
        timestamp=datetime.now(timezone.utc),
        current_state=operational_state,
        prediction=Prediction(
            forecast_horizon_minutes=10,
            predicted_queue_length=75,
            predicted_arrival_rate_per_min=1.2,
            predicted_wait_minutes=6.0,
            predicted_congestion_level=CongestionLevel.HIGH,
            prediction_confidence=0.85
        ),
        resources=ResourceState(
            spare_counters=2,
            reallocatable_resources=1
        ),
        priority=PriorityInfo(
            time_critical_users=3,
            vulnerable_users=5
        )
    )

    assert opt_input.current_state.queue_length == 73


def test_deterministic_adapter_behavior():
    """Adapter behavior is deterministic given same crowd count."""
    crowd_result = {"people_count": 30, "location_id": "TEST", "camera_id": "CAM1", "timestamp": "2026-08-26T20:00:00+00:00", "source": "simulation"}
    state1 = camera_count_to_operational_state(crowd_result)
    state2 = camera_count_to_operational_state(crowd_result)

    assert state1.queue_length == state2.queue_length == 30
    assert state1.active_counters == state2.active_counters == 4


def test_video_mode_software_processing():
    """Video mode processing using software detections list."""
    processor = CameraProcessor()
    detections = ["person", "car", "person", "chair", "PERSON"]
    result = processor.process_video(
        location_id="HOSPITAL_001",
        camera_id="CAM_VIDEO_01",
        detections=detections
    )

    assert result["people_count"] == 3
    assert result["source"] == "video"
    assert result["location_id"] == "HOSPITAL_001"


def test_live_camera_temporal_smoothing():
    """Test LiveCamera temporal smoothing (rolling median)."""
    camera = LiveCamera(smoothing_window=5)
    
    # Check initial values
    assert camera.smooth_count(1) == 1
    assert camera.smooth_count(1) == 1
    
    # Transient spike (e.g. hand waving produces 5 and 3)
    assert camera.smooth_count(5) == 1  # Window: [1, 1, 5] -> median 1
    assert camera.smooth_count(2) == 1  # Window: [1, 1, 5, 2] -> median 1.5 rounded to 2 or 1 depending on int(round)
    assert camera.smooth_count(1) == 1  # Window: [1, 1, 5, 2, 1] -> median 1
    
    # Real transition to 2 people
    assert camera.smooth_count(2) == 2  # Window: [1, 5, 2, 1, 2] -> sorted [1, 1, 2, 2, 5] -> median 2
    assert camera.smooth_count(2) == 2  # Window: [5, 2, 1, 2, 2] -> sorted [1, 2, 2, 2, 5] -> median 2


def test_live_camera_roi_filtering():
    """Test LiveCamera ROI boundary checking."""
    # ROI covering center [0.25, 0.25, 0.75, 0.75]
    camera = LiveCamera(roi=(0.25, 0.25, 0.75, 0.75), roi_enabled=True)
    
    # Center points in 1000x1000 frame
    # Inside ROI (500, 500)
    assert camera._is_inside_roi(500, 500, 1000, 1000) is True
    # Outside ROI (100, 100)
    assert camera._is_inside_roi(100, 100, 1000, 1000) is False
    # Outside ROI on edge (900, 500)
    assert camera._is_inside_roi(900, 500, 1000, 1000) is False

    # When ROI is disabled, all points are inside
    camera_disabled = LiveCamera(roi=(0.25, 0.25, 0.75, 0.75), roi_enabled=False)
    assert camera_disabled._is_inside_roi(100, 100, 1000, 1000) is True


# =========================================================================
# Video Demonstration Mode Tests
# =========================================================================

def test_video_demo_invalid_path():
    """VideoDemo must raise FileNotFoundError for nonexistent video paths and ValueError for empty/invalid paths."""
    with pytest.raises(ValueError):
        VideoDemo(video_path="")

    with pytest.raises(ValueError):
        VideoDemo(video_path=None)

    with pytest.raises(FileNotFoundError, match="does not exist"):
        VideoDemo(video_path="non_existent_demo_video_9999.mp4")


def test_video_demo_unopenable_file(tmp_path):
    """VideoDemo must raise RuntimeError when a file exists but cannot be opened/decoded by OpenCV."""
    bad_file = tmp_path / "corrupt_video.mp4"
    bad_file.write_text("This is plain text, not a valid encoded video stream.")
    
    with pytest.raises(RuntimeError, match="unable to open or decode"):
        VideoDemo(video_path=str(bad_file))


def test_video_demo_frame_processing(tmp_path):
    """VideoDemo process_frame processes a frame, applies smoothing, and outputs sanitized telemetry."""
    # Create a small valid test video so initialization succeeds
    test_video = tmp_path / "test_frame_proc.mp4"
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(test_video), fourcc, 10.0, (160, 120))
    for _ in range(3):
        out.write(np.zeros((120, 160, 3), dtype=np.uint8))
    out.release()

    demo = VideoDemo(video_path=str(test_video), smoothing_window=3)
    frame = np.zeros((120, 160, 3), dtype=np.uint8)

    crowd_result, detections, raw_count, stable_count = demo.process_frame(frame)

    assert isinstance(crowd_result, dict)
    assert crowd_result["source"] == "video"
    assert crowd_result["location_id"] == "DEMO_HOSPITAL_001"
    assert crowd_result["camera_id"] == "DEMO_VIDEO_01"
    assert crowd_result["people_count"] == 0
    assert raw_count == 0
    assert stable_count == 0
    assert PrivacyLayer.is_privacy_compliant(crowd_result) is True


def test_video_demo_clean_end_of_video(tmp_path):
    """VideoDemo run() loops through all video frames and terminates cleanly at EOF."""
    test_video = tmp_path / "test_clean_eof.mp4"
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(test_video), fourcc, 20.0, (160, 120))
    # Write 6 synthetic black frames
    for _ in range(6):
        out.write(np.zeros((120, 160, 3), dtype=np.uint8))
    out.release()

    demo = VideoDemo(video_path=str(test_video), smoothing_window=5)
    frames_processed, last_result = demo.run(display=False)

    assert frames_processed == 6
    assert isinstance(last_result, dict)
    assert last_result["source"] == "video"
    assert "people_count" in last_result


