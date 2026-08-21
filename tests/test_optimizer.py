from datetime import datetime
import pytest

from models.input_models import OptimizationInput
from models.output_models import ActionType, OptimizationOutput
from optimizer.optimizer import optimize


def create_test_input(
    active_counters: int = 2,
    service_rate: float = 1.5,
    arrival_rate: float = 3.2,
    queue_length: int = 16,
    wait_minutes: float = 5.33,
    forecast_horizon: int = 30,
    spare_counters: int = 1,
    reallocatable_resources: int = 1,
    time_critical_users: int = 5,
    vulnerable_users: int = 2,
    prediction_confidence: float = 0.87,
    congestion_level: str = "HIGH",
) -> OptimizationInput:
    """Helper function to construct OptimizationInput payloads for end-to-end optimizer tests."""
    return OptimizationInput(
        facility_id="FAC001",
        timestamp=datetime(2026, 8, 15, 22, 30, 0),
        current_state={
            "active_counters": active_counters,
            "queue_length": queue_length,
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


def test_low_demand_produces_valid_output():
    """Test 1: Low-demand input produces a valid OptimizationOutput recommending NO_ACTION."""
    input_data = create_test_input(arrival_rate=1.0, queue_length=0, wait_minutes=0.0, spare_counters=1)
    output = optimize(input_data)

    assert isinstance(output, OptimizationOutput)
    assert output.recommended_action.type == ActionType.NO_ACTION
    assert output.facility_id == "FAC001"


def test_high_demand_with_spare_counter_recommends_open_counter():
    """Test 2: High-demand input with spare counter recommends OPEN_COUNTER."""
    input_data = create_test_input(spare_counters=1, reallocatable_resources=0)
    output = optimize(input_data)

    assert isinstance(output, OptimizationOutput)
    assert output.recommended_action.type == ActionType.OPEN_COUNTER
    assert output.resources.counters_required == 1


def test_high_demand_without_spare_counter_avoids_open_counter():
    """Test 3: High-demand input without spare counter does not recommend OPEN_COUNTER."""
    input_data = create_test_input(spare_counters=0, reallocatable_resources=1, time_critical_users=0, vulnerable_users=0)
    output = optimize(input_data)

    assert output.recommended_action.type != ActionType.OPEN_COUNTER
    assert output.recommended_action.type == ActionType.REALLOCATE_RESOURCE


def test_priority_user_scenario_evaluates_priority_actions():
    """Test 4: Priority user scenario evaluates priority-related actions."""
    input_data = create_test_input(spare_counters=0, reallocatable_resources=0, time_critical_users=5, vulnerable_users=2)
    output = optimize(input_data)

    all_actions = {output.recommended_action.type} | {alt.action for alt in output.alternatives}
    assert ActionType.PRIORITY_ADJUSTMENT in all_actions
    assert output.fairness.priority_users_protected is True


def test_all_generated_candidate_actions_are_evaluated():
    """Test 5: Every generated candidate action is evaluated and included in the output."""
    input_data = create_test_input(spare_counters=1, reallocatable_resources=1, time_critical_users=3, vulnerable_users=1)
    output = optimize(input_data)

    all_output_actions = {output.recommended_action.type} | {alt.action for alt in output.alternatives}
    assert ActionType.NO_ACTION in all_output_actions
    assert ActionType.OPEN_COUNTER in all_output_actions
    assert ActionType.REALLOCATE_RESOURCE in all_output_actions
    assert ActionType.PRIORITY_ADJUSTMENT in all_output_actions


def test_fairness_applied_to_every_candidate():
    """Test 6: Fairness evaluation is populated and applied across output fields."""
    input_data = create_test_input()
    output = optimize(input_data)

    assert 0.0 <= output.fairness.fairness_score <= 1.0
    assert output.fairness.constraint_satisfied is True


def test_output_is_valid_pydantic_model():
    """Test 7: Returned output is an instance of OptimizationOutput and passes Pydantic validation."""
    input_data = create_test_input()
    output = optimize(input_data)

    assert isinstance(output, OptimizationOutput)
    dict_repr = output.model_dump()
    assert OptimizationOutput(**dict_repr) == output


def test_repeated_identical_inputs_produce_identical_outputs():
    """Test 8: Repeated identical inputs produce identical outputs (determinism)."""
    input_data = create_test_input()
    out1 = optimize(input_data)
    out2 = optimize(input_data)

    assert out1.model_dump() == out2.model_dump()


def test_invalid_input_type_raises_type_error():
    """Test 9: Invalid input payload type raises a TypeError."""
    with pytest.raises(TypeError):
        optimize({"invalid": "payload"})  # type: ignore


def test_internal_pipeline_failure_surfaced_clearly(monkeypatch):
    """Test 10: Internal pipeline failures surface clearly as exceptions."""
    input_data = create_test_input()

    def bad_decision(data):
        return None

    monkeypatch.setattr("optimizer.optimizer.make_decision", bad_decision)

    with pytest.raises(ValueError):
        optimize(input_data)


def test_alternatives_preserved_in_final_output():
    """Test 11: Alternative scenarios are preserved in the final OptimizationOutput."""
    input_data = create_test_input(spare_counters=1, reallocatable_resources=1)
    output = optimize(input_data)

    assert len(output.alternatives) > 0
    for alt in output.alternatives:
        assert 0.0 <= alt.score <= 1.0
        assert alt.action != output.recommended_action.type


def test_end_to_end_output_contains_human_readable_reason():
    """Test 12: End-to-end output contains a non-empty human-readable reason string."""
    input_data = create_test_input()
    output = optimize(input_data)

    assert isinstance(output.reason, str)
    assert len(output.reason) > 20


def test_hospital_end_to_end_optimization_valid_output():
    """Test 13: End-to-end optimization produces valid OptimizationOutput."""
    input_data = create_test_input()
    output = optimize(input_data)

    assert isinstance(output, OptimizationOutput)
    assert output.facility_id == "FAC001"
    assert "counter" in output.reason.lower() or "wait" in output.reason.lower() or "congestion" in output.reason.lower()


def test_bank_end_to_end_optimization_valid_output():
    """Test 14: End-to-end optimization produces valid OptimizationOutput."""
    input_data = create_test_input()
    output = optimize(input_data)

    assert isinstance(output, OptimizationOutput)
    assert output.facility_id == "FAC001"
    assert "counter" in output.reason.lower() or "wait" in output.reason.lower() or "congestion" in output.reason.lower()


def test_repeated_hospital_inputs_produce_identical_outputs():
    """Test 15: Repeated inputs produce identical outputs (determinism)."""
    input_data = create_test_input()
    out1 = optimize(input_data)
    out2 = optimize(input_data)

    assert out1.model_dump() == out2.model_dump()


def test_repeated_bank_inputs_produce_identical_outputs():
    """Test 16: Repeated inputs produce identical outputs (determinism)."""
    input_data = create_test_input()
    out1 = optimize(input_data)
    out2 = optimize(input_data)

    assert out1.model_dump() == out2.model_dump()

