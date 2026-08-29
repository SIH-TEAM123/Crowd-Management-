"""Comprehensive unit tests for the healthcare emergency priority and fairness layer."""

import pytest
from datetime import datetime, timezone

from camera import CameraProcessor
from emergency import (
    EmergencyEvent,
    validate_emergency_event,
    calculate_emergency_priority_score,
    evaluate_emergency_fairness,
    combine_camera_and_emergency,
    emergency_to_optimization_input,
)
from models.input_models import (
    OptimizationInput,
    CurrentOperationalState,
    Prediction,
    ResourceState,
    PriorityInfo,
    CongestionLevel,
)
from models.output_models import ActionType
from optimizer.optimizer import optimize


def test_hospital_emergency_accepted():
    """1. Hospital emergency accepted as eligible."""
    data = {
        "location_id": "HOSP_001",
        "location_type": "hospital",
        "emergency_active": True,
        "emergency_type": "critical_patient",
        "severity": "critical",
    }
    event = validate_emergency_event(data)
    assert event.eligible is True
    assert event.location_type == "hospital"
    assert event.emergency_active is True


def test_clinic_emergency_accepted():
    """2. Clinic emergency accepted as eligible."""
    data = {
        "location_id": "CLINIC_001",
        "location_type": "clinic",
        "emergency_active": True,
        "emergency_type": "ambulance_arrival",
        "severity": "high",
    }
    event = validate_emergency_event(data)
    assert event.eligible is True
    assert event.location_type == "clinic"


def test_health_center_emergency_accepted():
    """3. Health center emergency accepted as eligible."""
    data = {
        "location_id": "HC_001",
        "location_type": "health_center",
        "emergency_active": True,
        "emergency_type": "medical_emergency",
        "severity": "medium",
    }
    event = validate_emergency_event(data)
    assert event.eligible is True


def test_medical_center_emergency_accepted():
    """4. Medical center emergency accepted as eligible."""
    data = {
        "location_id": "MC_001",
        "location_type": "medical_center",
        "emergency_active": True,
        "emergency_type": "triage_overload",
        "severity": "low",
    }
    event = validate_emergency_event(data)
    assert event.eligible is True


def test_bank_emergency_rejected():
    """5. Bank emergency rejected (ineligible for healthcare emergency priority)."""
    data = {
        "location_id": "BANK_001",
        "location_type": "bank",
        "emergency_active": True,
        "emergency_type": "critical_patient",
        "severity": "critical",
    }
    event = validate_emergency_event(data)
    assert event.eligible is False
    assert "bank" in event.reason.lower()


def test_office_emergency_rejected():
    """6. Office emergency rejected (ineligible)."""
    data = {
        "location_id": "OFFICE_001",
        "location_type": "office",
        "emergency_active": True,
        "emergency_type": "medical_emergency",
        "severity": "high",
    }
    event = validate_emergency_event(data)
    assert event.eligible is False


def test_railway_station_emergency_rejected():
    """7. Railway station emergency rejected (ineligible)."""
    data = {
        "location_id": "STATION_001",
        "location_type": "railway_station",
        "emergency_active": True,
        "emergency_type": "critical_patient",
        "severity": "critical",
    }
    event = validate_emergency_event(data)
    assert event.eligible is False


def test_invalid_emergency_type_rejected():
    """8. Invalid emergency type rejected safely."""
    data = {
        "location_id": "HOSP_001",
        "location_type": "hospital",
        "emergency_active": True,
        "emergency_type": "fire",
        "severity": "critical",
    }
    event = validate_emergency_event(data)
    assert event.eligible is False
    assert "fire" in event.reason.lower()


def test_invalid_severity_rejected():
    """9. Invalid severity rejected safely."""
    data = {
        "location_id": "HOSP_001",
        "location_type": "hospital",
        "emergency_active": True,
        "emergency_type": "critical_patient",
        "severity": "extreme",
    }
    event = validate_emergency_event(data)
    assert event.eligible is False
    assert "extreme" in event.reason.lower()


def test_missing_location_type_handled():
    """10. Missing location type handled safely without crash."""
    data = {
        "location_id": "HOSP_001",
        "emergency_active": True,
        "emergency_type": "critical_patient",
        "severity": "critical",
    }
    event = validate_emergency_event(data)
    assert event.eligible is False
    assert "missing" in event.reason.lower()


def test_critical_receives_highest_priority():
    """11. Critical emergency receives highest priority (1.0)."""
    event = validate_emergency_event({
        "location_id": "HOSP_001",
        "location_type": "hospital",
        "emergency_active": True,
        "emergency_type": "critical_patient",
        "severity": "critical",
    })
    score = calculate_emergency_priority_score(event)
    assert score == 1.0


def test_high_receives_lower_priority_than_critical():
    """12. High receives lower priority score than critical."""
    crit_event = validate_emergency_event({
        "location_id": "HOSP_001",
        "location_type": "hospital",
        "emergency_active": True,
        "emergency_type": "critical_patient",
        "severity": "critical",
    })
    high_event = validate_emergency_event({
        "location_id": "HOSP_001",
        "location_type": "hospital",
        "emergency_active": True,
        "emergency_type": "critical_patient",
        "severity": "high",
    })
    crit_score = calculate_emergency_priority_score(crit_event)
    high_score = calculate_emergency_priority_score(high_event)
    assert crit_score > high_score
    assert high_score == 0.8


def test_medium_receives_lower_priority_than_high():
    """13. Medium receives lower priority score than high."""
    high_score = calculate_emergency_priority_score(validate_emergency_event({
        "location_id": "HOSP_001", "location_type": "hospital", "emergency_active": True, "emergency_type": "ambulance_arrival", "severity": "high"
    }))
    med_score = calculate_emergency_priority_score(validate_emergency_event({
        "location_id": "HOSP_001", "location_type": "hospital", "emergency_active": True, "emergency_type": "ambulance_arrival", "severity": "medium"
    }))
    assert high_score > med_score
    assert med_score == 0.5


def test_low_receives_lower_priority_than_medium():
    """14. Low receives lower priority score than medium."""
    med_score = calculate_emergency_priority_score(validate_emergency_event({
        "location_id": "HOSP_001", "location_type": "hospital", "emergency_active": True, "emergency_type": "medical_emergency", "severity": "medium"
    }))
    low_score = calculate_emergency_priority_score(validate_emergency_event({
        "location_id": "HOSP_001", "location_type": "hospital", "emergency_active": True, "emergency_type": "medical_emergency", "severity": "low"
    }))
    assert med_score > low_score
    assert low_score == 0.2


def test_normal_requests_remain_possible():
    """15. Normal non-emergency requests remain possible (anti-starvation)."""
    opt_input = OptimizationInput(
        facility_id="HOSP_001",
        institution_type="hospital",
        timestamp=datetime.now(timezone.utc),
        current_state=CurrentOperationalState(
            active_counters=4,
            queue_length=10,
            arrival_rate_per_min=1.0,
            service_rate_per_counter_per_min=0.5,
            average_wait_minutes=5.0,
            utilization=0.5,
        ),
        prediction=Prediction(
            forecast_horizon_minutes=10,
            predicted_queue_length=12,
            predicted_arrival_rate_per_min=1.0,
            predicted_wait_minutes=5.0,
            predicted_congestion_level=CongestionLevel.MEDIUM,
            prediction_confidence=0.85,
        ),
        resources=ResourceState(spare_counters=2, reallocatable_resources=1),
        priority=PriorityInfo(time_critical_users=0, vulnerable_users=0),
    )

    output = optimize(opt_input)
    assert output is not None
    assert output.recommended_action is not None


def test_existing_fairness_constraints_active():
    """16. Existing fairness constraints remain active."""
    opt_input = OptimizationInput(
        facility_id="HOSP_001",
        institution_type="hospital",
        timestamp=datetime.now(timezone.utc),
        current_state=CurrentOperationalState(
            active_counters=4, queue_length=5, arrival_rate_per_min=0.5,
            service_rate_per_counter_per_min=0.5, average_wait_minutes=2.0, utilization=0.2
        ),
        prediction=Prediction(
            forecast_horizon_minutes=10, predicted_queue_length=5, predicted_arrival_rate_per_min=0.5,
            predicted_wait_minutes=2.0, predicted_congestion_level=CongestionLevel.LOW, prediction_confidence=0.9
        ),
        resources=ResourceState(spare_counters=1, reallocatable_resources=0),
        priority=PriorityInfo(time_critical_users=0, vulnerable_users=0),
    )

    event = validate_emergency_event({
        "location_id": "HOSP_001", "location_type": "hospital", "emergency_active": True,
        "emergency_type": "critical_patient", "severity": "critical"
    })

    fairness_res = evaluate_emergency_fairness(opt_input, event, ActionType.NO_ACTION)
    assert fairness_res["constraint_satisfied"] is True
    assert fairness_res["emergency_priority_score"] == 1.0


def test_no_unavailable_resources_invented():
    """17. Unavailable resources are not invented (spare_counters=0)."""
    opt_input = OptimizationInput(
        facility_id="HOSP_001",
        institution_type="hospital",
        timestamp=datetime.now(timezone.utc),
        current_state=CurrentOperationalState(
            active_counters=4, queue_length=20, arrival_rate_per_min=2.0,
            service_rate_per_counter_per_min=0.5, average_wait_minutes=10.0, utilization=0.9
        ),
        prediction=Prediction(
            forecast_horizon_minutes=10, predicted_queue_length=25, predicted_arrival_rate_per_min=2.0,
            predicted_wait_minutes=12.0, predicted_congestion_level=CongestionLevel.HIGH, prediction_confidence=0.8
        ),
        resources=ResourceState(spare_counters=0, reallocatable_resources=0),
        priority=PriorityInfo(time_critical_users=1, vulnerable_users=0),
    )

    event = validate_emergency_event({
        "location_id": "HOSP_001", "location_type": "hospital", "emergency_active": True,
        "emergency_type": "critical_patient", "severity": "critical"
    })

    fairness_res = evaluate_emergency_fairness(opt_input, event, ActionType.OPEN_COUNTER)
    assert fairness_res["resource_feasible"] is False
    assert fairness_res["constraint_satisfied"] is False
    assert "0 spare counters available" in fairness_res["reason"]


def test_decision_is_deterministic():
    """18. Repeated emergency decision evaluations are strictly deterministic."""
    data = {
        "location_id": "HOSP_001", "location_type": "hospital", "emergency_active": True,
        "emergency_type": "ambulance_arrival", "severity": "high"
    }
    e1 = validate_emergency_event(data)
    e2 = validate_emergency_event(data)

    s1 = calculate_emergency_priority_score(e1)
    s2 = calculate_emergency_priority_score(e2)
    assert s1 == s2 == 0.8


def test_human_readable_rejection_reason_exists():
    """19. Human-readable rejection reason exists for ineligible events."""
    data = {
        "location_id": "MALL_001", "location_type": "shopping_mall", "emergency_active": True,
        "emergency_type": "critical_patient", "severity": "critical"
    }
    event = validate_emergency_event(data)
    assert event.eligible is False
    assert len(event.reason) > 0
    assert "shopping_mall" in event.reason


def test_camera_people_count_maps_to_queue_length():
    """20. Camera people_count maps directly to CurrentOperationalState.queue_length."""
    processor = CameraProcessor()
    crowd_res = processor.process_simulation(location_id="HOSP_001", people_count=73)
    em_data = {"location_id": "HOSP_001", "location_type": "hospital", "emergency_active": True, "emergency_type": "critical_patient", "severity": "critical"}

    combined = combine_camera_and_emergency(crowd_res, em_data)
    opt_input = emergency_to_optimization_input(combined)

    assert opt_input.current_state.queue_length == 73


def test_camera_privacy_fields_do_not_leak():
    """21. Camera privacy fields do not leak into combined output."""
    crowd_res = {
        "location_id": "HOSP_001", "camera_id": "CAM1", "people_count": 50,
        "timestamp": "2026-08-26T20:00:00Z", "source": "simulation",
        "face": "binary", "name": "Secret", "embedding": [1, 2, 3]
    }
    em_data = {"location_id": "HOSP_001", "location_type": "hospital", "emergency_active": True, "emergency_type": "ambulance_arrival", "severity": "high"}

    combined = combine_camera_and_emergency(crowd_res, em_data)

    assert "face" not in combined
    assert "name" not in combined
    assert "embedding" not in combined
    assert combined["people_count"] == 50


def test_image_frame_face_data_rejected():
    """22. Image, frame, and face data are rejected/stripped."""
    em_data = {
        "location_id": "HOSP_001", "location_type": "hospital", "emergency_active": True,
        "emergency_type": "critical_patient", "severity": "critical",
        "image": "jpg_bytes", "frame": "raw_frame", "face_id": "F123"
    }
    crowd_res = {"location_id": "HOSP_001", "camera_id": "CAM1", "people_count": 10, "timestamp": "2026-08-26T20:00:00Z", "source": "simulation"}

    combined = combine_camera_and_emergency(crowd_res, em_data)

    assert "image" not in combined
    assert "frame" not in combined
    assert "face_id" not in combined


def test_no_physical_camera_hardware_required():
    """23. Software pipeline executes fully without physical camera hardware."""
    processor = CameraProcessor()
    crowd_res = processor.process_simulation(location_id="HOSP_001", people_count=25)
    em_data = {"location_id": "HOSP_001", "location_type": "hospital", "emergency_active": True, "emergency_type": "triage_overload", "severity": "medium"}

    combined = combine_camera_and_emergency(crowd_res, em_data)
    assert combined["people_count"] == 25
    assert combined["emergency_priority"] == 0.5


def test_combined_camera_plus_emergency_state_works():
    """24. Combined camera + emergency state works end-to-end."""
    processor = CameraProcessor()
    crowd_res = processor.process_simulation(location_id="CLINIC_100", people_count=42)
    em_data = {
        "location_id": "CLINIC_100",
        "location_type": "clinic",
        "emergency_active": True,
        "emergency_type": "ambulance_arrival",
        "severity": "critical"
    }

    combined = combine_camera_and_emergency(crowd_res, em_data)
    opt_input = emergency_to_optimization_input(combined)
    output = optimize(opt_input)

    assert output is not None
    assert opt_input.current_state.queue_length == 42
    assert opt_input.priority.time_critical_users == 1
