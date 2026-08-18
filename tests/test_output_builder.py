"""Unit tests for Person 4 output builder module."""

from datetime import datetime
import pytest

from models.input_models import CongestionLevel, OptimizationInput
from models.output_models import ActionType, DecisionStatus, OptimizationOutput
from optimizer.decision_engine import DecisionResult, EvaluatedScenario, make_decision
from optimizer.output_builder import build_optimization_output, derive_congestion_level


def create_test_input(
    active_counters: int = 2,
    service_rate: float = 1.5,
    arrival_rate: float = 3.2,
    queue_length: int = 16,
    wait_minutes: float = 5.33,
    spare_counters: int = 1,
    reallocatable_resources: int = 1,
    time_critical_users: int = 5,
    vulnerable_users: int = 2,
) -> OptimizationInput:
    """Helper function to construct OptimizationInput payloads for output builder tests."""
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
            "forecast_horizon_minutes": 30,
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


def test_open_counter_conversion():
    """Test 1: OPEN_COUNTER decision converts correctly into OptimizationOutput."""
    input_data = create_test_input(spare_counters=1, reallocatable_resources=0)
    dec_res = make_decision(input_data)
    assert dec_res.selected_action == ActionType.OPEN_COUNTER

    output = build_optimization_output(input_data, dec_res)

    assert isinstance(output, OptimizationOutput)
    assert output.facility_id == "FAC001"
    assert output.recommended_action.type == ActionType.OPEN_COUNTER
    assert output.decision.status == DecisionStatus.RECOMMEND
    assert output.resources.counters_required == 1
    assert output.resources.resources_required == 0


def test_no_action_conversion():
    """Test 2: NO_ACTION decision converts correctly into OptimizationOutput."""
    input_data = create_test_input(arrival_rate=1.0, queue_length=0, wait_minutes=0.0)
    dec_res = make_decision(input_data)
    assert dec_res.selected_action == ActionType.NO_ACTION

    output = build_optimization_output(input_data, dec_res)

    assert output.recommended_action.type == ActionType.NO_ACTION
    assert output.recommended_action.resource is None
    assert output.decision.status == DecisionStatus.NO_ACTION
    assert output.resources.counters_required == 0
    assert output.resources.resources_required == 0


def test_reallocate_resource_conversion():
    """Test 3: REALLOCATE_RESOURCE decision converts correctly into OptimizationOutput."""
    input_data = create_test_input(spare_counters=0, reallocatable_resources=1, time_critical_users=0, vulnerable_users=0)
    dec_res = make_decision(input_data)
    assert dec_res.selected_action == ActionType.REALLOCATE_RESOURCE

    output = build_optimization_output(input_data, dec_res)

    assert output.recommended_action.type == ActionType.REALLOCATE_RESOURCE
    assert output.decision.status == DecisionStatus.RECOMMEND
    assert output.resources.counters_required == 0
    assert output.resources.resources_required == 1


def test_priority_adjustment_conversion():
    """Test 4: PRIORITY_ADJUSTMENT decision converts correctly into OptimizationOutput."""
    input_data = create_test_input(spare_counters=0, reallocatable_resources=0, time_critical_users=5, vulnerable_users=2)

    pa_scenario = EvaluatedScenario(
        action=ActionType.PRIORITY_ADJUSTMENT,
        feasible=True,
        predicted_wait_minutes=5.33,
        predicted_queue_length=16,
        predicted_utilization=0.8,
        fairness_score=0.8,
        fairness_constraint_satisfied=True,
        score=0.75,
        rejection_reason=None,
    )
    no_action_scenario = EvaluatedScenario(
        action=ActionType.NO_ACTION,
        feasible=True,
        predicted_wait_minutes=5.33,
        predicted_queue_length=16,
        predicted_utilization=0.8,
        fairness_score=1.0,
        fairness_constraint_satisfied=True,
        score=0.25,
        rejection_reason=None,
    )
    dec_res = DecisionResult(
        selected_action=ActionType.PRIORITY_ADJUSTMENT,
        score=0.75,
        confidence=0.85,
        reason="Priority adjustment recommended to protect priority users.",
        evaluated_scenarios=[pa_scenario, no_action_scenario],
    )

    output = build_optimization_output(input_data, dec_res)

    assert output.recommended_action.type == ActionType.PRIORITY_ADJUSTMENT
    assert output.decision.status == DecisionStatus.RECOMMEND
    assert output.resources.counters_required == 0
    assert output.resources.resources_required == 0


def test_selected_scenario_fields_populated():
    """Test 5: Selected scenario metrics become OptimizationOutput impact fields correctly."""
    input_data = create_test_input()
    dec_res = make_decision(input_data)
    output = build_optimization_output(input_data, dec_res)

    selected = next(s for s in dec_res.evaluated_scenarios if s.action == dec_res.selected_action)

    assert output.impact.predicted_wait_minutes == selected.predicted_wait_minutes
    assert output.impact.predicted_queue_length == selected.predicted_queue_length
    assert output.impact.predicted_utilization == selected.predicted_utilization


def test_alternatives_correctly_populated():
    """Test 6: Alternatives list excludes selected action and correctly populates fields."""
    input_data = create_test_input()
    dec_res = make_decision(input_data)
    output = build_optimization_output(input_data, dec_res)

    alt_actions = [a.action for a in output.alternatives]
    assert dec_res.selected_action not in alt_actions
    assert len(output.alternatives) == len(dec_res.evaluated_scenarios) - 1


def test_resource_mapping():
    """Test 7: Resource mapping correctly differentiates counters vs reallocatable resources."""
    input_data_counter = create_test_input(spare_counters=1, reallocatable_resources=0)
    out_counter = build_optimization_output(input_data_counter, make_decision(input_data_counter))
    assert out_counter.resources.counters_required == 1
    assert out_counter.resources.resources_required == 0

    input_data_realloc = create_test_input(spare_counters=0, reallocatable_resources=1, time_critical_users=0, vulnerable_users=0)
    out_realloc = build_optimization_output(input_data_realloc, make_decision(input_data_realloc))
    assert out_realloc.resources.counters_required == 0
    assert out_realloc.resources.resources_required == 1


def test_fairness_fields_copied():
    """Test 8: Fairness score and protection flags are correctly copied into OptimizationOutput."""
    input_data = create_test_input(time_critical_users=3, vulnerable_users=2)
    dec_res = make_decision(input_data)
    output = build_optimization_output(input_data, dec_res)

    assert output.fairness.priority_users_protected is True
    assert output.fairness.constraint_satisfied is True
    assert 0.0 <= output.fairness.fairness_score <= 1.0


def test_derive_congestion_level():
    """Test 9: Congestion level derivation for LOW, MEDIUM, HIGH, CRITICAL utilization ranges."""
    assert derive_congestion_level(0.40) == CongestionLevel.LOW
    assert derive_congestion_level(0.60) == CongestionLevel.LOW
    assert derive_congestion_level(0.70) == CongestionLevel.MEDIUM
    assert derive_congestion_level(0.80) == CongestionLevel.MEDIUM
    assert derive_congestion_level(0.90) == CongestionLevel.HIGH
    assert derive_congestion_level(0.95) == CongestionLevel.HIGH
    assert derive_congestion_level(0.99) == CongestionLevel.CRITICAL


def test_invalid_decision_result_error():
    """Test 10: Invalid DecisionResult or infeasible selected scenario raises appropriate exception."""
    input_data = create_test_input()

    with pytest.raises(TypeError):
        build_optimization_output({"invalid": "input"}, make_decision(input_data))  # type: ignore

    with pytest.raises(TypeError):
        build_optimization_output(input_data, {"invalid": "decision"})  # type: ignore

    # Infeasible scenario test
    bad_scenario = EvaluatedScenario(
        action=ActionType.OPEN_COUNTER,
        feasible=False,
        predicted_wait_minutes=10.0,
        predicted_queue_length=20,
        predicted_utilization=0.8,
        fairness_score=1.0,
        fairness_constraint_satisfied=True,
        score=0.0,
        rejection_reason="Infeasible",
    )
    bad_dec_res = DecisionResult(
        selected_action=ActionType.OPEN_COUNTER,
        score=0.0,
        confidence=0.5,
        reason="Infeasible test",
        evaluated_scenarios=[bad_scenario],
    )

    with pytest.raises(ValueError):
        build_optimization_output(input_data, bad_dec_res)


def test_deterministic_repeated_conversion():
    """Test 11: Converting identical DecisionResults produces identical OptimizationOutput payloads."""
    input_data = create_test_input()
    dec_res = make_decision(input_data)

    out1 = build_optimization_output(input_data, dec_res)
    out2 = build_optimization_output(input_data, dec_res)

    assert out1.model_dump() == out2.model_dump()
