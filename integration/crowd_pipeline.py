"""End-to-end software integration pipeline for SIH P4 Crowd Management."""

from typing import Any, Dict, List, Optional
from camera import CameraProcessor, InputMode, PrivacyLayer
from emergency import (
    combine_camera_and_emergency,
    emergency_to_optimization_input,
    validate_emergency_event,
)
from models.input_models import OptimizationInput
from models.output_models import OptimizationOutput
from optimizer.optimizer import optimize


def run_crowd_pipeline(
    *,
    people_count: Optional[int] = None,
    detections: Optional[List[Any]] = None,
    location_id: str = "HOSPITAL_001",
    camera_id: str = "CAMERA_01",
    location_type: str = "hospital",
    input_mode: InputMode = InputMode.SIMULATION,
    emergency_data: Optional[Dict[str, Any]] = None,
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
    raw_camera_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Execute end-to-end crowd sensing, emergency validation, data transformation, and decision optimization pipeline.

    Orchestrates existing modules without duplicating logic:
    CameraProcessor -> PrivacyLayer -> validate_emergency_event -> combine_camera_and_emergency
    -> emergency_to_optimization_input -> optimize()

    Returns:
        Dict[str, Any]: Structured dictionary containing sanitized_crowd_state, emergency_state,
                       optimization_input, and decision_result.
    """
    # 1. Camera Sensing & Privacy Sanitization Step
    processor = CameraProcessor()

    if input_mode == InputMode.SIMULATION:
        raw_count = people_count if people_count is not None else 0
        crowd_result = processor.process_simulation(
            location_id=location_id,
            camera_id=camera_id,
            people_count=raw_count,
        )
    elif input_mode == InputMode.VIDEO:
        crowd_result = processor.process_video(
            location_id=location_id,
            camera_id=camera_id,
            detections=detections,
            people_count=people_count,
        )
    elif input_mode == InputMode.CAMERA_RESERVED:
        crowd_result = processor.process_camera_reserved(
            location_id=location_id,
            camera_id=camera_id,
        )
    else:
        raise ValueError(f"Unsupported input mode: {input_mode}")

    # If raw_camera_metadata contained additional keys, sanitize again for safety
    if raw_camera_metadata and isinstance(raw_camera_metadata, dict):
        merged_raw = {**raw_camera_metadata, **crowd_result}
        crowd_result = PrivacyLayer.sanitize_crowd_data(merged_raw)

    # 2. Emergency Validation Step
    em_input = emergency_data.copy() if emergency_data else {}
    if "location_id" not in em_input:
        em_input["location_id"] = location_id
    if "location_type" not in em_input:
        em_input["location_type"] = location_type

    validated_emergency = validate_emergency_event(em_input)

    # 3. Combine Camera Crowd Result with Emergency State
    combined_state = combine_camera_and_emergency(crowd_result, em_input)

    # 4. Map Combined State to Person 4 OptimizationInput Model
    opt_facility_id = facility_id or location_id
    opt_inst_type = institution_type or location_type

    opt_input: OptimizationInput = emergency_to_optimization_input(
        combined_state=combined_state,
        facility_id=opt_facility_id,
        institution_type=opt_inst_type,
        active_counters=active_counters,
        arrival_rate_per_min=arrival_rate_per_min,
        service_rate_per_counter_per_min=service_rate_per_counter_per_min,
        average_wait_minutes=average_wait_minutes,
        utilization=utilization,
        spare_counters=spare_counters,
        reallocatable_resources=reallocatable_resources,
        vulnerable_users=vulnerable_users,
    )

    # 5. Execute Person 4 Decision Optimizer
    decision_result: OptimizationOutput = optimize(opt_input)

    # 6. Construct Structured Pipeline Result Output
    emergency_state_summary = {
        "location_id": combined_state.get("location_id", location_id),
        "location_type": validated_emergency.location_type,
        "emergency_active": validated_emergency.emergency_active,
        "emergency_type": validated_emergency.emergency_type,
        "severity": validated_emergency.severity,
        "eligible": validated_emergency.eligible,
        "priority_score": combined_state.get("emergency_priority", 0.0),
        "reason": validated_emergency.reason,
    }

    return {
        "sanitized_crowd_state": crowd_result,
        "emergency_state": emergency_state_summary,
        "optimization_input": opt_input,
        "decision_result": decision_result,
    }
