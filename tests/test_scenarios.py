"""Unit tests for Person 4 scenario generator module."""

from datetime import datetime
import pytest

from models.input_models import OptimizationInput
from models.output_models import ActionType
from optimizer.scenario_generator import generate_scenarios


def create_test_input(
    spare_counters: int = 0,
    reallocatable_resources: int = 0,
    time_critical_users: int = 0,
    vulnerable_users: int = 0,
) -> OptimizationInput:
    """Helper to create an OptimizationInput with specific resource/priority counts."""
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


def test_all_actions_available():
    """Test scenario generation when all resource and priority conditions are met."""
    input_data = create_test_input(
        spare_counters=1,
        reallocatable_resources=1,
        time_critical_users=5,
        vulnerable_users=2,
    )
    result = generate_scenarios(input_data)
    assert result == [
        ActionType.NO_ACTION,
        ActionType.OPEN_COUNTER,
        ActionType.REALLOCATE_RESOURCE,
        ActionType.PRIORITY_ADJUSTMENT,
    ]


def test_only_no_action_available():
    """Test scenario generation when no spare resources or priority users exist."""
    input_data = create_test_input(
        spare_counters=0,
        reallocatable_resources=0,
        time_critical_users=0,
        vulnerable_users=0,
    )
    result = generate_scenarios(input_data)
    assert result == [ActionType.NO_ACTION]


def test_open_counter_only():
    """Test scenario generation when only spare counters exist."""
    input_data = create_test_input(
        spare_counters=2,
        reallocatable_resources=0,
        time_critical_users=0,
        vulnerable_users=0,
    )
    result = generate_scenarios(input_data)
    assert result == [
        ActionType.NO_ACTION,
        ActionType.OPEN_COUNTER,
    ]


def test_reallocate_resource_only():
    """Test scenario generation when only reallocatable resources exist."""
    input_data = create_test_input(
        spare_counters=0,
        reallocatable_resources=1,
        time_critical_users=0,
        vulnerable_users=0,
    )
    result = generate_scenarios(input_data)
    assert result == [
        ActionType.NO_ACTION,
        ActionType.REALLOCATE_RESOURCE,
    ]


def test_priority_adjustment_only_time_critical():
    """Test scenario generation when only time-critical priority users exist."""
    input_data = create_test_input(
        spare_counters=0,
        reallocatable_resources=0,
        time_critical_users=3,
        vulnerable_users=0,
    )
    result = generate_scenarios(input_data)
    assert result == [
        ActionType.NO_ACTION,
        ActionType.PRIORITY_ADJUSTMENT,
    ]


def test_priority_adjustment_only_vulnerable():
    """Test scenario generation when only vulnerable priority users exist."""
    input_data = create_test_input(
        spare_counters=0,
        reallocatable_resources=0,
        time_critical_users=0,
        vulnerable_users=4,
    )
    result = generate_scenarios(input_data)
    assert result == [
        ActionType.NO_ACTION,
        ActionType.PRIORITY_ADJUSTMENT,
    ]


def test_invalid_input_type():
    """Test that passing an invalid type raises a TypeError."""
    with pytest.raises(TypeError):
        generate_scenarios({"facility_id": "INVALID"})  # type: ignore
