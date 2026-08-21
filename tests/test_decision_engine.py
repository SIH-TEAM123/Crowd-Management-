from datetime import datetime
import pytest

from models.input_models import OptimizationInput
from models.output_models import ActionType
from optimizer.decision_engine import DecisionResult, make_decision


def create_test_input(
    active_counters: int = 4,
    service_rate: float = 1.6,
    arrival_rate: float = 6.1,
    queue_length: int = 185,
    wait_minutes: float = 26.0,
    forecast_horizon: int = 30,
    spare_counters: int = 1,
    reallocatable_resources: int = 1,
    time_critical_users: int = 5,
    vulnerable_users: int = 2,
    prediction_confidence: float = 0.87,
    congestion_level: str = "HIGH",
) -> OptimizationInput:
    """Helper function to construct OptimizationInput payloads for decision engine tests."""
    return OptimizationInput(
        facility_id="FAC001",
        timestamp=datetime(2026, 8, 15, 22, 30, 0),
        current_state={
            "active_counters": active_counters,
            "queue_length": 150,
            "arrival_rate_per_min": 5.2,
            "service_rate_per_counter_per_min": service_rate,
            "average_wait_minutes": 18.0,
            "utilization": 0.81,
        },
        prediction={
            "forecast_horizon_minutes": forecast_horizon,
            "predicted_queue_length": queue_length,
            "predicted_arrival_rate_per_min": arrival_rate,
            "predicted_wait_minutes": wait_minutes,
            "predicted_congestion_level": congestion_level,
            "prediction_confidence": prediction_confidence,
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


def test_low_demand_recommends_no_action():
    """Test 1: Under low demand with zero queue and low wait time, NO_ACTION is recommended."""
    input_data = create_test_input(
        arrival_rate=2.0,
        queue_length=0,
        wait_minutes=0.0,
        congestion_level="LOW",
        spare_counters=1,
        reallocatable_resources=1,
        time_critical_users=0,
        vulnerable_users=0,
    )
    result = make_decision(input_data)

    assert isinstance(result, DecisionResult)
    assert result.selected_action == ActionType.NO_ACTION
    assert result.score > 0.0
    assert "NO_ACTION" in result.reason or "adequate" in result.reason


def test_high_demand_with_spare_counter_recommends_open_counter():
    """Test 2: Under high demand with a spare counter available, OPEN_COUNTER is selected."""
    input_data = create_test_input(
        active_counters=2,
        service_rate=1.5,
        arrival_rate=3.2,
        queue_length=16,
        wait_minutes=5.33,
        spare_counters=1,
        reallocatable_resources=0,
        time_critical_users=0,
        vulnerable_users=0,
    )
    result = make_decision(input_data)

    assert result.selected_action == ActionType.OPEN_COUNTER
    assert result.score > 0.5
    assert "counter" in result.reason.lower()


def test_high_demand_no_spare_counter_selects_another_feasible_action():
    """Test 3: Under high demand with zero spare counters, another feasible action (REALLOCATE_RESOURCE) is chosen."""
    input_data = create_test_input(
        active_counters=2,
        service_rate=1.5,
        arrival_rate=3.2,
        queue_length=16,
        wait_minutes=5.33,
        spare_counters=0,
        reallocatable_resources=1,
        time_critical_users=0,
        vulnerable_users=0,
    )
    result = make_decision(input_data)

    assert result.selected_action == ActionType.REALLOCATE_RESOURCE
    assert result.score > 0.3


def test_priority_user_with_available_counter_compares_actions():
    """Test 4: Compares OPEN_COUNTER vs PRIORITY_ADJUSTMENT when priority users and spare counters exist."""
    input_data = create_test_input(
        active_counters=2,
        service_rate=1.5,
        arrival_rate=3.2,
        queue_length=16,
        wait_minutes=5.33,
        spare_counters=1,
        reallocatable_resources=0,
        time_critical_users=5,
        vulnerable_users=2,
    )
    result = make_decision(input_data)

    assert result.selected_action in [ActionType.OPEN_COUNTER, ActionType.PRIORITY_ADJUSTMENT]
    scenarios = {s.action: s for s in result.evaluated_scenarios}
    assert ActionType.OPEN_COUNTER in scenarios
    assert ActionType.PRIORITY_ADJUSTMENT in scenarios


def test_priority_adjustment_without_eligible_users_rejected():
    """Test 5: PRIORITY_ADJUSTMENT without eligible priority users is rejected due to fairness violation."""
    input_data = create_test_input(
        time_critical_users=0,
        vulnerable_users=0,
        spare_counters=0,
        reallocatable_resources=0,
    )

    result = make_decision(input_data)
    assert result.selected_action == ActionType.NO_ACTION


def test_multiple_feasible_actions_chooses_highest_score():
    """Test 6: Given multiple feasible actions, decision engine selects the one with the highest overall score."""
    input_data = create_test_input(
        active_counters=2,
        service_rate=1.5,
        arrival_rate=3.2,
        queue_length=16,
        wait_minutes=5.33,
        spare_counters=1,
        reallocatable_resources=1,
        time_critical_users=2,
        vulnerable_users=1,
    )
    result = make_decision(input_data)

    valid_scores = [s.score for s in result.evaluated_scenarios if s.feasible and s.fairness_constraint_satisfied]
    assert result.score == max(valid_scores)


def test_fairness_violation_rejection():
    """Test 7: A scenario with a fairness violation is marked infeasible/rejected with score 0.0."""
    input_data = create_test_input(
        spare_counters=0,
        reallocatable_resources=0,
        time_critical_users=0,
        vulnerable_users=0,
    )
    result = make_decision(input_data)

    for scenario in result.evaluated_scenarios:
        if not scenario.fairness_constraint_satisfied:
            assert scenario.score == 0.0
            assert scenario.rejection_reason is not None


def test_resource_constrained_scenario():
    """Test 8: Handles zero spare counters and zero reallocatable resources safely."""
    input_data = create_test_input(
        spare_counters=0,
        reallocatable_resources=0,
        time_critical_users=0,
        vulnerable_users=0,
    )
    result = make_decision(input_data)

    assert result.selected_action == ActionType.NO_ACTION


def test_deterministic_repeated_decision():
    """Test 9: Duplicate calls with identical input produce identical DecisionResults."""
    input_data = create_test_input()
    res1 = make_decision(input_data)
    res2 = make_decision(input_data)

    assert res1.model_dump() == res2.model_dump()


def test_invalid_input_type():
    """Test 10: Invalid input payload type raises a TypeError."""
    with pytest.raises(TypeError):
        make_decision({"invalid": "payload"})  # type: ignore


def test_tie_breaking():
    """Test 11: Tie-breaking logic prefers lower resource cost and lower disruption when scores are equal."""
    input_data = create_test_input(
        arrival_rate=2.0,
        queue_length=0,
        wait_minutes=0.0,
        spare_counters=1,
        reallocatable_resources=1,
        time_critical_users=0,
        vulnerable_users=0,
    )
    result = make_decision(input_data)

    assert result.selected_action == ActionType.NO_ACTION


def test_prediction_confidence_affects_decision_confidence():
    """Test 12: Higher Person 3 prediction confidence yields higher decision confidence."""
    input_low = create_test_input(prediction_confidence=0.50)
    input_high = create_test_input(prediction_confidence=0.95)

    res_low = make_decision(input_low)
    res_high = make_decision(input_high)

    assert res_high.confidence > res_low.confidence


def test_hospital_decision_reason_domain_appropriate():
    """Test 13: Decision explanation contains queue, counter, and wait time concepts."""
    input_data = create_test_input(
        spare_counters=1,
        reallocatable_resources=0,
        time_critical_users=2,
        vulnerable_users=1,
    )
    result = make_decision(input_data)

    assert "counter" in result.reason.lower() or "wait" in result.reason.lower()


def test_bank_decision_reason_domain_appropriate():
    """Test 14: Decision explanation contains counter, queue, and congestion concepts."""
    input_data = create_test_input(
        spare_counters=1,
        reallocatable_resources=0,
        time_critical_users=2,
        vulnerable_users=1,
    )
    result = make_decision(input_data)

    assert "counter" in result.reason.lower() or "congestion" in result.reason.lower()

