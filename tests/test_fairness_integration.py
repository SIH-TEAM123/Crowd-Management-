from datetime import datetime
import pytest

from camera import InputMode
from emergency.emergency_rules import EmergencyEvent
from emergency.priority_engine import (
    calculate_emergency_priority_score,
    evaluate_emergency_fairness,
)
from integration.crowd_pipeline import run_crowd_pipeline
from models.input_models import OptimizationInput
from models.output_models import ActionType, OptimizationOutput
from optimizer.decision_engine import make_decision
from optimizer.fairness import (
    P5PriorityType,
    calculate_jain_fairness_index,
    calculate_priority_score_with_wait,
    evaluate_fairness,
    evaluate_p5_priority_compatibility,
    evaluate_starvation_risk,
)
from qr.qr_payload import QRPayload
from qr.qr_service import QRService


def create_test_input(
    active_counters: int = 4,
    queue_length: int = 50,
    average_wait_minutes: float = 8.0,
    spare_counters: int = 1,
    reallocatable_resources: int = 1,
    time_critical_users: int = 0,
    vulnerable_users: int = 0,
) -> OptimizationInput:
    """Helper function to construct OptimizationInput payloads for fairness tests."""
    return OptimizationInput(
        facility_id="FAC_FAIRNESS_01",
        timestamp=datetime(2026, 8, 30, 10, 0, 0),
        current_state={
            "active_counters": active_counters,
            "queue_length": queue_length,
            "arrival_rate_per_min": 3.0,
            "service_rate_per_counter_per_min": 1.0,
            "average_wait_minutes": average_wait_minutes,
            "utilization": 0.65,
        },
        prediction={
            "forecast_horizon_minutes": 30,
            "predicted_queue_length": queue_length + 10,
            "predicted_arrival_rate_per_min": 3.5,
            "predicted_wait_minutes": average_wait_minutes + 2.0,
            "predicted_congestion_level": "MEDIUM",
            "prediction_confidence": 0.90,
        },
        resources={
            "spare_counters": spare_counters,
            "reallocatable_resources": reallocatable_resources,
        },
        priority={
            "time_critical_users": time_critical_users,
            "vulnerable_users": vulnerable_users,
        },
    )


def test_1_normal_vs_vulnerable_priority():
    """1. NORMAL vs VULNERABLE priority evaluation."""
    input_data = create_test_input(vulnerable_users=3, time_critical_users=0)
    res_no_action = evaluate_fairness(input_data, ActionType.NO_ACTION)
    res_priority = evaluate_fairness(input_data, ActionType.PRIORITY_ADJUSTMENT)

    assert res_no_action.fairness_score == 1.0
    assert res_no_action.priority_users_protected is True
    assert res_priority.priority_users_protected is True
    assert res_priority.constraint_satisfied is True

    # P5 priority weight check
    score_normal = calculate_priority_score_with_wait(P5PriorityType.NORMAL, 0)
    score_vulnerable = calculate_priority_score_with_wait(P5PriorityType.VULNERABLE, 0)
    assert score_vulnerable > score_normal


def test_2_normal_vs_time_critical_priority():
    """2. NORMAL vs TIME_CRITICAL priority evaluation."""
    input_data = create_test_input(time_critical_users=5, vulnerable_users=0)
    res_priority = evaluate_fairness(input_data, ActionType.PRIORITY_ADJUSTMENT)

    assert res_priority.fairness_score == 0.8
    assert res_priority.priority_users_protected is True
    assert res_priority.constraint_satisfied is True

    # P5 priority weight check
    score_normal = calculate_priority_score_with_wait(P5PriorityType.NORMAL, 0)
    score_tc = calculate_priority_score_with_wait(P5PriorityType.TIME_CRITICAL, 0)
    assert score_tc > score_normal


def test_3_long_waiting_normal_user():
    """3. Long-waiting NORMAL user priority accumulation prevents starvation."""
    # A NORMAL user waiting 35 minutes should accumulate higher score than a newly arrived VULNERABLE user
    score_long_normal = calculate_priority_score_with_wait(P5PriorityType.NORMAL, 35.0)
    score_new_vulnerable = calculate_priority_score_with_wait(P5PriorityType.VULNERABLE, 0.0)

    assert score_long_normal > score_new_vulnerable
    assert score_long_normal == 4.5  # 1.0 + (35 * 0.1)


def test_4_starvation_prevention():
    """4. Starvation prevention logic flags high wait times and demands capacity expansion."""
    input_data = create_test_input(average_wait_minutes=28.0, queue_length=120)
    starvation_info = evaluate_starvation_risk(
        average_wait_minutes=input_data.current_state.average_wait_minutes,
        priority_users_count=5,
        total_queue_length=input_data.current_state.queue_length,
    )

    assert starvation_info["starvation_risk"] == "HIGH"
    assert starvation_info["requires_capacity_expansion"] is True

    open_res = evaluate_fairness(input_data, ActionType.OPEN_COUNTER)
    assert open_res.fairness_score == 1.0
    assert open_res.constraint_satisfied is True


def test_5_emergency_priority_does_not_bypass_fairness_indefinitely():
    """5. Emergency priority grants high priority score but respects fairness constraints."""
    event = EmergencyEvent(
        location_id="HOSPITAL_001",
        location_type="hospital",
        emergency_active=True,
        emergency_type="trauma",
        severity="critical",
        eligible=True,
        reason="Mass casualty inbound",
    )

    score = calculate_emergency_priority_score(event)
    assert score == 1.0

    input_data = create_test_input(time_critical_users=2, vulnerable_users=1)
    em_fairness = evaluate_emergency_fairness(input_data, event, ActionType.OPEN_COUNTER)

    assert em_fairness["emergency_active"] is True
    assert em_fairness["emergency_priority_score"] == 1.0
    assert em_fairness["priority_users_protected"] is True
    assert em_fairness["constraint_satisfied"] is True


def test_6_zero_available_resources_respected():
    """6. Zero available resources are strictly respected (never invented)."""
    input_data = create_test_input(
        spare_counters=0,
        reallocatable_resources=0,
        time_critical_users=0,
        vulnerable_users=0,
    )

    open_res = evaluate_fairness(input_data, ActionType.OPEN_COUNTER)
    assert open_res.constraint_satisfied is False
    assert "0 spare counters available" in open_res.reason

    realloc_res = evaluate_fairness(input_data, ActionType.REALLOCATE_RESOURCE)
    assert realloc_res.constraint_satisfied is False
    assert "0 reallocatable resources available" in realloc_res.reason

    decision = make_decision(input_data)
    assert decision.selected_action == ActionType.NO_ACTION


def test_7_deterministic_repeated_decisions():
    """7. Repeated optimization calls with identical input produce identical decisions."""
    input_data = create_test_input(time_critical_users=3, vulnerable_users=1)
    res1 = make_decision(input_data)
    res2 = make_decision(input_data)

    assert res1.model_dump() == res2.model_dump()
    assert res1.selected_action == res2.selected_action
    assert res1.score == res2.score


def test_8_camera_people_count_to_queue_length_integration():
    """8. Camera people_count maps directly to queue_length in end-to-end crowd pipeline."""
    pipeline_result = run_crowd_pipeline(
        people_count=45,
        location_id="HOSPITAL_CAMERA_01",
        input_mode=InputMode.SIMULATION,
        spare_counters=1,
        vulnerable_users=2,
    )

    assert "sanitized_crowd_state" in pipeline_result
    assert pipeline_result["sanitized_crowd_state"]["people_count"] == 45
    assert pipeline_result["optimization_input"].current_state.queue_length == 45

    opt_output: OptimizationOutput = pipeline_result["decision_result"]
    assert isinstance(opt_output, OptimizationOutput)
    assert hasattr(opt_output, "fairness")
    assert opt_output.fairness.constraint_satisfied is True
    assert 0.0 <= opt_output.fairness.fairness_score <= 1.0


def test_9_p5_priority_types_compatibility():
    """9. P5 priority types (NORMAL, VULNERABLE, TIME_CRITICAL) compatibility evaluation."""
    priority_counts = {"NORMAL": 15, "VULNERABLE": 3, "TIME_CRITICAL": 1}
    eval_res = evaluate_p5_priority_compatibility(priority_counts)

    assert eval_res["p5_compatible"] is True
    assert eval_res["counts"]["NORMAL"] == 15
    assert eval_res["counts"]["VULNERABLE"] == 3
    assert eval_res["counts"]["TIME_CRITICAL"] == 1
    assert eval_res["total_priority_users"] == 4
    assert eval_res["has_priority_users"] is True
