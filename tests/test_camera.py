"""Comprehensive unit tests for the software camera sensing layer and Person 4 integration."""

from datetime import datetime, timezone
import pytest

from camera import (
    CameraConfig,
    CameraProcessor,
    InputMode,
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
