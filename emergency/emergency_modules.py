"""Integration module combining camera crowd sensing with healthcare emergency management."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from camera.privacy import PrivacyLayer
from emergency.emergency_rules import validate_emergency_event, EmergencyEvent
from emergency.priority_engine import calculate_emergency_priority_score
from models.input_models import (
    CongestionLevel,
    CurrentOperationalState,
    OptimizationInput,
    Prediction,
    PriorityInfo,
    ResourceState,
)


def combine_camera_and_emergency(
    crowd_result: Dict[str, Any], emergency_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Combine camera crowd sensing output with validated healthcare emergency state.

    Applies strict privacy enforcement, stripping any sensitive face/identity/image fields.

    Args:
        crowd_result: Sanitized dictionary output from CameraProcessor.
        emergency_data: Raw emergency payload input.

    Returns:
        Dict[str, Any]: Combined state dictionary containing crowd count and emergency metadata.
    """
    # 1. Enforce privacy on camera result
    sanitized_crowd = PrivacyLayer.sanitize_crowd_data(crowd_result)

    # 2. Validate emergency event
    validated_event: EmergencyEvent = validate_emergency_event(emergency_data)
    priority_score = calculate_emergency_priority_score(validated_event)

    combined = {
        "location_id": sanitized_crowd.get("location_id", validated_event.location_id),
        "camera_id": sanitized_crowd.get("camera_id", "UNKNOWN"),
        "people_count": sanitized_crowd.get("people_count", 0),
        "timestamp": sanitized_crowd.get("timestamp", datetime.now(timezone.utc).isoformat()),
        "source": sanitized_crowd.get("source", "simulation"),
        "location_type": validated_event.location_type,
        "emergency_active": validated_event.emergency_active,
        "emergency_type": validated_event.emergency_type,
        "severity": validated_event.severity,
        "emergency_eligible": validated_event.eligible,
        "emergency_priority": priority_score,
        "emergency_reason": validated_event.reason,
    }

    # Verify no prohibited privacy keys exist in combined output
    for key in list(combined.keys()):
        if key in ("face", "face_id", "embedding", "embeddings", "name", "person_id",
                   "identity", "identities", "image", "images", "frame", "frames",
                   "tracking_id", "biometrics", "bounding_box"):
            del combined[key]

    return combined


def emergency_to_optimization_input(
    combined_state: Dict[str, Any],
    facility_id: Optional[str] = None,
    institution_type: Optional[str] = None,
    active_counters: int = 4,
    arrival_rate_per_min: float = 1.0,
    service_rate_per_counter_per_min: float = 0.5,
    average_wait_minutes: float = 5.0,
    utilization: float = 0.5,
    spare_counters: int = 2,
    reallocatable_resources: int = 1,
    vulnerable_users: int = 0,
) -> OptimizationInput:
    """Convert combined camera/emergency state dictionary into Person 4 OptimizationInput model.

    Maps camera `people_count` to `CurrentOperationalState.queue_length`.

    Args:
        combined_state: Output dictionary from combine_camera_and_emergency.
        facility_id: Optional facility identifier override.
        institution_type: Optional institution descriptor override.
        active_counters: Active counter count.
        arrival_rate_per_min: Arrival rate per minute.
        service_rate_per_counter_per_min: Service rate per counter per minute.
        average_wait_minutes: Average wait time in minutes.
        utilization: Resource utilization ratio (0.0 to 1.0).
        spare_counters: Spare counters count.
        reallocatable_resources: Reallocatable resources count.
        vulnerable_users: Count of vulnerable queue users.

    Returns:
        OptimizationInput: Validated Pydantic OptimizationInput model payload.
    """
    fac_id = facility_id or str(combined_state.get("location_id", "HOSPITAL_001"))
    inst_type = institution_type or str(combined_state.get("location_type", "hospital"))
    people_count = int(combined_state.get("people_count", 0))

    is_emergency = bool(combined_state.get("emergency_eligible", False)) and bool(
        combined_state.get("emergency_active", False)
    )

    # Determine time-critical users count based on emergency status
    time_critical = 1 if is_emergency else 0

    current_state = CurrentOperationalState(
        active_counters=active_counters,
        queue_length=people_count,
        arrival_rate_per_min=arrival_rate_per_min,
        service_rate_per_counter_per_min=service_rate_per_counter_per_min,
        average_wait_minutes=average_wait_minutes,
        utilization=utilization,
        completed_service_times=[],
    )

    # Estimate predicted queue and congestion
    predicted_queue = max(0, people_count + 2)
    if predicted_queue < 5:
        congestion = CongestionLevel.LOW
    elif predicted_queue < 15:
        congestion = CongestionLevel.MEDIUM
    elif predicted_queue < 30:
        congestion = CongestionLevel.HIGH
    else:
        congestion = CongestionLevel.CRITICAL

    prediction = Prediction(
        forecast_horizon_minutes=10,
        predicted_queue_length=predicted_queue,
        predicted_arrival_rate_per_min=arrival_rate_per_min,
        predicted_wait_minutes=average_wait_minutes,
        predicted_congestion_level=congestion,
        prediction_confidence=0.85,
    )

    resources = ResourceState(
        spare_counters=spare_counters,
        reallocatable_resources=reallocatable_resources,
    )

    priority = PriorityInfo(
        time_critical_users=time_critical,
        vulnerable_users=vulnerable_users,
    )

    # Parse or format timezone-aware timestamp
    ts_str = combined_state.get("timestamp")
    if ts_str:
        try:
            ts = datetime.fromisoformat(ts_str)
        except (ValueError, TypeError):
            ts = datetime.now(timezone.utc)
    else:
        ts = datetime.now(timezone.utc)

    return OptimizationInput(
        facility_id=fac_id,
        institution_type=inst_type,
        timestamp=ts,
        current_state=current_state,
        prediction=prediction,
        resources=resources,
        priority=priority,
    )
