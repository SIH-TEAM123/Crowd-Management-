"""End-to-end integration tests for SIH P4 Crowd Management pipeline."""

import pytest
from camera import InputMode
from integration import run_crowd_pipeline
from models.output_models import OptimizationOutput


def test_scenario_1_normal_hospital():
    """Scenario 1: Normal Hospital - 50 people, no active emergency."""
    result = run_crowd_pipeline(
        people_count=50,
        location_id="HOSP_001",
        location_type="hospital",
        emergency_data=None,
    )

    crowd_state = result["sanitized_crowd_state"]
    em_state = result["emergency_state"]
    opt_input = result["optimization_input"]
    decision = result["decision_result"]

    assert crowd_state["people_count"] == 50
    assert opt_input.current_state.queue_length == 50
    assert em_state["eligible"] is False
    assert em_state["priority_score"] == 0.0
    assert isinstance(decision, OptimizationOutput)
    assert decision.recommended_action is not None


def test_scenario_2_critical_hospital_emergency():
    """Scenario 2: Critical Hospital Emergency - 50 people, critical_patient, critical severity."""
    emergency_payload = {
        "location_id": "HOSP_001",
        "location_type": "hospital",
        "emergency_active": True,
        "emergency_type": "critical_patient",
        "severity": "critical",
    }

    result = run_crowd_pipeline(
        people_count=50,
        location_id="HOSP_001",
        location_type="hospital",
        emergency_data=emergency_payload,
    )

    crowd_state = result["sanitized_crowd_state"]
    em_state = result["emergency_state"]
    opt_input = result["optimization_input"]
    decision = result["decision_result"]

    assert crowd_state["people_count"] == 50
    assert opt_input.current_state.queue_length == 50
    assert em_state["eligible"] is True
    assert em_state["priority_score"] == 1.0
    assert opt_input.priority.time_critical_users == 1
    assert isinstance(decision, OptimizationOutput)

    # Privacy verification
    for key in ("face", "image", "frame", "embedding", "person_id", "tracking_id"):
        assert key not in crowd_state
        assert key not in em_state


def test_scenario_3_ambulance_arrival():
    """Scenario 3: Ambulance Arrival - 80 people, hospital, ambulance_arrival, critical severity."""
    emergency_payload = {
        "location_id": "HOSP_002",
        "location_type": "hospital",
        "emergency_active": True,
        "emergency_type": "ambulance_arrival",
        "severity": "critical",
    }

    result = run_crowd_pipeline(
        people_count=80,
        location_id="HOSP_002",
        location_type="hospital",
        emergency_data=emergency_payload,
    )

    crowd_state = result["sanitized_crowd_state"]
    em_state = result["emergency_state"]
    opt_input = result["optimization_input"]

    assert crowd_state["people_count"] == 80
    assert opt_input.current_state.queue_length == 80
    assert em_state["eligible"] is True
    assert em_state["priority_score"] == 1.0


def test_scenario_4_clinic_medical_emergency():
    """Scenario 4: Clinic Medical Emergency - 40 people, clinic, medical_emergency, high severity."""
    emergency_payload = {
        "location_id": "CLINIC_001",
        "location_type": "clinic",
        "emergency_active": True,
        "emergency_type": "medical_emergency",
        "severity": "high",
    }

    result = run_crowd_pipeline(
        people_count=40,
        location_id="CLINIC_001",
        location_type="clinic",
        emergency_data=emergency_payload,
    )

    crowd_state = result["sanitized_crowd_state"]
    em_state = result["emergency_state"]
    opt_input = result["optimization_input"]

    assert crowd_state["people_count"] == 40
    assert opt_input.current_state.queue_length == 40
    assert em_state["eligible"] is True
    assert em_state["priority_score"] == 0.8


def test_scenario_5_invalid_emergency_location():
    """Scenario 5: Invalid Emergency Location - 100 people, bank, critical_patient -> rejected."""
    emergency_payload = {
        "location_id": "BANK_001",
        "location_type": "bank",
        "emergency_active": True,
        "emergency_type": "critical_patient",
        "severity": "critical",
    }

    result = run_crowd_pipeline(
        people_count=100,
        location_id="BANK_001",
        location_type="bank",
        emergency_data=emergency_payload,
    )

    crowd_state = result["sanitized_crowd_state"]
    em_state = result["emergency_state"]
    opt_input = result["optimization_input"]
    decision = result["decision_result"]

    assert crowd_state["people_count"] == 100
    assert opt_input.current_state.queue_length == 100
    assert em_state["eligible"] is False
    assert em_state["priority_score"] == 0.0
    assert "bank" in em_state["reason"].lower()
    assert isinstance(decision, OptimizationOutput)


def test_scenario_6_privacy_enforcement():
    """Scenario 6: Privacy Enforcement - Sensitive camera metadata stripped completely."""
    raw_metadata = {
        "face": "binary_jpeg_face_crop",
        "image": "full_frame_buffer",
        "frame": "opencv_mat_frame",
        "person_id": "PID_888",
        "tracking_id": "TRK_999",
        "embedding": [0.12, 0.45, 0.99],
        "biometrics": {"iris": "data"},
        "bounding_box": [10, 20, 100, 200],
    }

    result = run_crowd_pipeline(
        people_count=35,
        location_id="HOSP_001",
        location_type="hospital",
        raw_camera_metadata=raw_metadata,
    )

    crowd_state = result["sanitized_crowd_state"]

    # Approved aggregate keys only
    assert set(crowd_state.keys()) == {
        "location_id",
        "camera_id",
        "people_count",
        "timestamp",
        "source",
    }

    for key in (
        "face",
        "image",
        "frame",
        "person_id",
        "tracking_id",
        "embedding",
        "biometrics",
        "bounding_box",
    ):
        assert key not in crowd_state


def test_scenario_7_hardware_independence():
    """Scenario 7: Hardware Independence - Runs software simulation & detection filtering without camera hardware."""
    detections = ["person", "car", "person", "chair", "PERSON", "vehicle"]

    result = run_crowd_pipeline(
        detections=detections,
        input_mode=InputMode.VIDEO,
        location_id="HOSP_001",
        location_type="hospital",
    )

    crowd_state = result["sanitized_crowd_state"]
    opt_input = result["optimization_input"]

    assert crowd_state["people_count"] == 3
    assert opt_input.current_state.queue_length == 3


def test_determinism():
    """Scenario 8: Determinism - Running pipeline twice with same inputs produces identical output."""
    emergency_payload = {
        "location_id": "HOSP_001",
        "location_type": "hospital",
        "emergency_active": True,
        "emergency_type": "ambulance_arrival",
        "severity": "critical",
    }

    res1 = run_crowd_pipeline(
        people_count=60,
        location_id="HOSP_001",
        location_type="hospital",
        emergency_data=emergency_payload,
    )

    res2 = run_crowd_pipeline(
        people_count=60,
        location_id="HOSP_001",
        location_type="hospital",
        emergency_data=emergency_payload,
    )

    assert res1["sanitized_crowd_state"]["people_count"] == res2["sanitized_crowd_state"]["people_count"]
    assert res1["emergency_state"]["priority_score"] == res2["emergency_state"]["priority_score"]
    assert res1["decision_result"].recommended_action == res2["decision_result"].recommended_action


def test_resource_constraints_preserved():
    """Scenario 9: Resource Constraints - Spare counters = 0 prevents OPEN_COUNTER invention."""
    emergency_payload = {
        "location_id": "HOSP_001",
        "location_type": "hospital",
        "emergency_active": True,
        "emergency_type": "critical_patient",
        "severity": "critical",
    }

    result = run_crowd_pipeline(
        people_count=70,
        spare_counters=0,
        reallocatable_resources=0,
        emergency_data=emergency_payload,
    )

    decision = result["decision_result"]
    assert decision.recommended_action != "OPEN_COUNTER"
