"""Unit tests for Person 4 scenario simulator module."""

from datetime import datetime
import pytest

from models.input_models import OptimizationInput
from models.output_models import ActionType
from optimizer.scenario_simulator import ScenarioSimulationResult, simulate_scenario


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
) -> OptimizationInput:
    """Helper to construct a valid OptimizationInput for scenario simulation testing."""
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


def test_no_action_scenario():
    """Test 1: NO_ACTION scenario simulation behavior."""
    input_data = create_test_input()
    result = simulate_scenario(input_data, ActionType.NO_ACTION)

    assert isinstance(result, ScenarioSimulationResult)
    assert result.feasible is True
    assert result.resource_cost == 0
    assert result.predicted_queue_length == 185
    assert result.predicted_wait_minutes == 26.0
    assert 0.0 <= result.predicted_utilization <= 1.0


def test_open_counter_with_spare():
    """Test 2: OPEN_COUNTER scenario with available spare counters."""
    input_data = create_test_input(spare_counters=1)
    result = simulate_scenario(input_data, ActionType.OPEN_COUNTER)

    assert result.feasible is True
    assert result.resource_cost == 1
    assert 0.0 <= result.predicted_utilization <= 1.0
    # Capacity increases from 4 * 1.6 = 6.4 to 5 * 1.6 = 8.0, reducing queue length below baseline
    assert result.predicted_queue_length < 185
    assert result.predicted_wait_minutes < 26.0


def test_open_counter_without_spare():
    """Test 3: OPEN_COUNTER scenario without available spare counters."""
    input_data = create_test_input(spare_counters=0)
    result = simulate_scenario(input_data, ActionType.OPEN_COUNTER)

    assert result.feasible is False
    assert result.resource_cost == 0


def test_reallocate_resource_with_available_resource():
    """Test 4: REALLOCATE_RESOURCE scenario with available reallocatable resources."""
    input_data = create_test_input(reallocatable_resources=1)
    result = simulate_scenario(input_data, ActionType.REALLOCATE_RESOURCE)

    assert result.feasible is True
    assert result.resource_cost == 1
    # Service capacity increases by 10% (from 6.4 to 7.04), reducing queue length and wait time
    assert result.predicted_queue_length < 185
    assert result.predicted_wait_minutes < 26.0


def test_reallocate_resource_without_available_resource():
    """Test 5: REALLOCATE_RESOURCE scenario without available reallocatable resources."""
    input_data = create_test_input(reallocatable_resources=0)
    result = simulate_scenario(input_data, ActionType.REALLOCATE_RESOURCE)

    assert result.feasible is False
    assert result.resource_cost == 0


def test_priority_adjustment_with_eligible_users():
    """Test 6: PRIORITY_ADJUSTMENT scenario with eligible priority users."""
    input_data = create_test_input(time_critical_users=5, vulnerable_users=0)
    result = simulate_scenario(input_data, ActionType.PRIORITY_ADJUSTMENT)

    assert result.feasible is True
    assert result.resource_cost == 0
    # Physical capacity and total queue metrics remain unchanged for priority adjustment
    assert result.predicted_queue_length == 185
    assert result.predicted_wait_minutes == 26.0


def test_priority_adjustment_without_eligible_users():
    """Test 7: PRIORITY_ADJUSTMENT scenario without eligible priority users."""
    input_data = create_test_input(time_critical_users=0, vulnerable_users=0)
    result = simulate_scenario(input_data, ActionType.PRIORITY_ADJUSTMENT)

    assert result.feasible is False
    assert result.resource_cost == 0


def test_zero_service_rate_handling():
    """Test 8: Zero service rate does not trigger division-by-zero error."""
    input_data = create_test_input(service_rate=0.0)
    result = simulate_scenario(input_data, ActionType.NO_ACTION)

    assert result.feasible is True
    assert result.predicted_utilization == 1.0
    assert result.predicted_queue_length == 185
    assert result.predicted_wait_minutes == 26.0


def test_determinism():
    """Test 9: Running the same scenario twice yields identical results."""
    input_data = create_test_input()
    res1 = simulate_scenario(input_data, ActionType.OPEN_COUNTER)
    res2 = simulate_scenario(input_data, ActionType.OPEN_COUNTER)

    assert res1.model_dump() == res2.model_dump()


def test_invalid_input_and_action_types():
    """Test 10: Invalid input or action types raise TypeError."""
    input_data = create_test_input()

    with pytest.raises(TypeError):
        simulate_scenario({"invalid": "data"}, ActionType.NO_ACTION)  # type: ignore

    with pytest.raises(TypeError):
        simulate_scenario(input_data, "INVALID_ACTION")  # type: ignore
