from datetime import datetime
import pytest

from models.input_models import OptimizationInput
from models.output_models import ActionType
from optimizer.fairness_engine import (
    FairnessEvaluationResult,
    FairnessEvaluationStatus,
    evaluate_fairness,
)


def create_test_input(
    time_critical_users: int = 0,
    vulnerable_users: int = 0,
    spare_counters: int = 1,
    reallocatable_resources: int = 1,
) -> OptimizationInput:
    """Helper function to create an OptimizationInput for testing fairness evaluation."""
    return OptimizationInput(
        facility_id="FAC001",
        timestamp=datetime(2026, 8, 15, 22, 30, 0),
        current_state={
            "active_counters": 4,
            "queue_length": 150,
            "arrival_rate_per_min": 5.2,
            "service_rate_per_counter_per_min": 1.6,
            "average_wait_minutes": 18.0,
            "utilization": 0.81,
        },
        prediction={
            "forecast_horizon_minutes": 30,
            "predicted_queue_length": 185,
            "predicted_arrival_rate_per_min": 6.1,
            "predicted_wait_minutes": 26.0,
            "predicted_congestion_level": "HIGH",
            "prediction_confidence": 0.87,
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


def test_no_action_with_no_priority_users():
    """Test 1: NO_ACTION evaluation when no priority users are present."""
    input_data = create_test_input(time_critical_users=0, vulnerable_users=0)
    result = evaluate_fairness(input_data, ActionType.NO_ACTION)

    assert isinstance(result, FairnessEvaluationResult)
    assert result.fairness_score == 1.0
    assert result.priority_users_protected is False
    assert result.constraint_satisfied is True
    assert result.evaluation_status == FairnessEvaluationStatus.EVALUATED


def test_no_action_with_priority_users():
    """Test 2: NO_ACTION evaluation when priority users are present."""
    input_data = create_test_input(time_critical_users=3, vulnerable_users=2)
    result = evaluate_fairness(input_data, ActionType.NO_ACTION)

    assert result.fairness_score == 1.0
    assert result.priority_users_protected is True
    assert result.constraint_satisfied is True
    assert result.evaluation_status == FairnessEvaluationStatus.EVALUATED


def test_open_counter_with_priority_users():
    """Test 3: OPEN_COUNTER evaluation when priority users are present."""
    input_data = create_test_input(time_critical_users=4, vulnerable_users=1)
    result = evaluate_fairness(input_data, ActionType.OPEN_COUNTER)

    assert result.fairness_score == 1.0
    assert result.priority_users_protected is True
    assert result.constraint_satisfied is True
    assert result.evaluation_status == FairnessEvaluationStatus.EVALUATED


def test_reallocate_resource_with_no_priority_users():
    """Test 4: REALLOCATE_RESOURCE evaluation when no priority users are present."""
    input_data = create_test_input(time_critical_users=0, vulnerable_users=0)
    result = evaluate_fairness(input_data, ActionType.REALLOCATE_RESOURCE)

    assert result.fairness_score == 1.0
    assert result.priority_users_protected is False
    assert result.constraint_satisfied is True
    assert result.evaluation_status == FairnessEvaluationStatus.EVALUATED


def test_priority_adjustment_with_time_critical_users():
    """Test 5: PRIORITY_ADJUSTMENT evaluation with time-critical priority users."""
    input_data = create_test_input(time_critical_users=5, vulnerable_users=0)
    result = evaluate_fairness(input_data, ActionType.PRIORITY_ADJUSTMENT)

    assert result.fairness_score == 0.8
    assert result.priority_users_protected is True
    assert result.constraint_satisfied is True
    assert result.evaluation_status == FairnessEvaluationStatus.LIMITED_DATA


def test_priority_adjustment_with_vulnerable_users():
    """Test 6: PRIORITY_ADJUSTMENT evaluation with vulnerable priority users."""
    input_data = create_test_input(time_critical_users=0, vulnerable_users=4)
    result = evaluate_fairness(input_data, ActionType.PRIORITY_ADJUSTMENT)

    assert result.fairness_score == 0.8
    assert result.priority_users_protected is True
    assert result.constraint_satisfied is True
    assert result.evaluation_status == FairnessEvaluationStatus.LIMITED_DATA


def test_priority_adjustment_with_no_priority_users():
    """Test 7: PRIORITY_ADJUSTMENT evaluation with no priority users produces a fairness violation."""
    input_data = create_test_input(time_critical_users=0, vulnerable_users=0)
    result = evaluate_fairness(input_data, ActionType.PRIORITY_ADJUSTMENT)

    assert result.fairness_score == 0.0
    assert result.priority_users_protected is False
    assert result.constraint_satisfied is False
    assert result.evaluation_status == FairnessEvaluationStatus.VIOLATION


def test_deterministic_repeated_evaluation():
    """Test 8: Duplicate calls with identical input produce identical fairness evaluation outputs."""
    input_data = create_test_input(time_critical_users=2, vulnerable_users=3)
    res1 = evaluate_fairness(input_data, ActionType.REALLOCATE_RESOURCE)
    res2 = evaluate_fairness(input_data, ActionType.REALLOCATE_RESOURCE)

    assert res1.model_dump() == res2.model_dump()


def test_invalid_input_type():
    """Test 9: Invalid input payload type raises a TypeError."""
    with pytest.raises(TypeError):
        evaluate_fairness({"invalid": "payload"}, ActionType.NO_ACTION)  # type: ignore


def test_invalid_action_type():
    """Test 10: Invalid action type string raises a TypeError."""
    input_data = create_test_input()
    with pytest.raises(TypeError):
        evaluate_fairness(input_data, "INVALID_ACTION")  # type: ignore


def test_hospital_time_critical_user_protection():
    """Test 11: Time-critical users are protected and receive generic explanation."""
    input_data = create_test_input(time_critical_users=3, vulnerable_users=1)
    result = evaluate_fairness(input_data, ActionType.PRIORITY_ADJUSTMENT)

    assert result.priority_users_protected is True
    assert result.constraint_satisfied is True
    assert "time-critical and vulnerable users" in result.reason


def test_bank_vulnerable_user_protection():
    """Test 12: Vulnerable users are protected and receive generic explanation."""
    input_data = create_test_input(time_critical_users=0, vulnerable_users=4)
    result = evaluate_fairness(input_data, ActionType.PRIORITY_ADJUSTMENT)

    assert result.priority_users_protected is True
    assert result.constraint_satisfied is True
    assert "time-critical and vulnerable users" in result.reason


def test_bank_normal_user_starvation_prevention():
    """Test 13: Normal users are not starved when priority adjustment is applied."""
    input_data = create_test_input(time_critical_users=2, vulnerable_users=2)
    result = evaluate_fairness(input_data, ActionType.PRIORITY_ADJUSTMENT)

    assert result.constraint_satisfied is True
    assert "preventing normal user queue starvation" in result.reason

