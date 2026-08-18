"""Unit tests for Person 4 input and output Pydantic data models."""

import pytest
from pydantic import ValidationError

from models.input_models import (
    CongestionLevel,
    CurrentOperationalState,
    OptimizationInput,
    Prediction,
    PriorityInfo,
    ResourceState,
)
from models.output_models import (
    ActionType,
    AlternativeScenario,
    DecisionInfo,
    DecisionStatus,
    FairnessInfo,
    ImpactInfo,
    OptimizationOutput,
    RecommendedAction,
    ResourceRequirement,
)


def get_valid_input_dict() -> dict:
    """Helper to return a valid input dictionary for testing."""
    return {
        "facility_id": "FAC001",
        "institution_type": "GENERIC",
        "timestamp": "2026-08-15T22:30:00",
        "current_state": {
            "active_counters": 4,
            "queue_length": 150,
            "arrival_rate_per_min": 5.2,
            "service_rate_per_counter_per_min": 1.6,
            "average_wait_minutes": 18.0,
            "utilization": 0.81,
            "completed_service_times": [5.0, 6.0],
        },
        "prediction": {
            "forecast_horizon_minutes": 30,
            "predicted_queue_length": 185,
            "predicted_arrival_rate_per_min": 6.1,
            "predicted_wait_minutes": 26.0,
            "predicted_congestion_level": "HIGH",
            "prediction_confidence": 0.87,
        },
        "resources": {
            "spare_counters": 1,
            "reallocatable_resources": 1,
        },
        "priority": {
            "time_critical_users": 8,
            "vulnerable_users": 5,
        },
    }


def get_valid_output_dict() -> dict:
    """Helper to return a valid output dictionary for testing."""
    return {
        "facility_id": "FAC001",
        "recommended_action": {
            "type": "OPEN_COUNTER",
            "resource": "COUNTER_5",
        },
        "decision": {
            "status": "RECOMMEND",
            "score": 0.86,
            "confidence": 0.87,
        },
        "impact": {
            "predicted_wait_minutes": 17.2,
            "predicted_queue_length": 122,
            "predicted_utilization": 0.74,
            "congestion_level": "MEDIUM",
        },
        "resources": {
            "counters_required": 1,
            "resources_required": 1,
        },
        "fairness": {
            "fairness_score": 0.94,
            "priority_users_protected": True,
            "constraint_satisfied": True,
        },
        "reason": "Opening one available counter is projected to reduce waiting time and congestion while remaining within available resources.",
        "alternatives": [
            {
                "action": "NO_ACTION",
                "predicted_wait_minutes": 26.0,
                "predicted_queue_length": 185,
                "predicted_utilization": 0.81,
                "score": 0.42,
                "feasible": True,
            }
        ],
    }


def test_valid_input():
    """Test that a complete valid input payload constructs OptimizationInput successfully."""
    input_data = get_valid_input_dict()
    model = OptimizationInput(**input_data)
    assert model.facility_id == "FAC001"
    assert model.institution_type == "GENERIC"
    assert model.current_state.queue_length == 150
    assert model.prediction.predicted_congestion_level == CongestionLevel.HIGH
    assert model.resources.spare_counters == 1
    assert model.priority.vulnerable_users == 5


def test_institution_type_acceptance_and_validation():
    """Test that string values or None are accepted for optional institution_type."""
    data = get_valid_input_dict()
    data["institution_type"] = "ANY_FACILITY"
    model1 = OptimizationInput(**data)
    assert model1.institution_type == "ANY_FACILITY"

    # Test None acceptance
    data_none = get_valid_input_dict()
    data_none["institution_type"] = None
    model2 = OptimizationInput(**data_none)
    assert model2.institution_type is None

    # Test omitted institution_type acceptance (defaults to None)
    data_omitted = get_valid_input_dict()
    del data_omitted["institution_type"]
    model3 = OptimizationInput(**data_omitted)
    assert model3.institution_type is None



def test_invalid_negative_values():
    """Test that negative values for counters, queue length, and rates fail validation."""

    # Negative queue length
    data_bad_queue = get_valid_input_dict()
    data_bad_queue["current_state"]["queue_length"] = -1
    with pytest.raises(ValidationError):
        OptimizationInput(**data_bad_queue)

    # Negative active counters
    data_bad_counters = get_valid_input_dict()
    data_bad_counters["current_state"]["active_counters"] = -1
    with pytest.raises(ValidationError):
        OptimizationInput(**data_bad_counters)

    # Negative arrival rate
    data_bad_arrival = get_valid_input_dict()
    data_bad_arrival["current_state"]["arrival_rate_per_min"] = -1.0
    with pytest.raises(ValidationError):
        OptimizationInput(**data_bad_arrival)


def test_invalid_utilization():
    """Test that utilization values below 0 or above 1 fail validation."""
    data_low = get_valid_input_dict()
    data_low["current_state"]["utilization"] = -0.1
    with pytest.raises(ValidationError):
        OptimizationInput(**data_low)

    data_high = get_valid_input_dict()
    data_high["current_state"]["utilization"] = 1.05
    with pytest.raises(ValidationError):
        OptimizationInput(**data_high)


def test_invalid_prediction_confidence():
    """Test that prediction confidence below 0 or above 1 fails validation."""
    data_low = get_valid_input_dict()
    data_low["prediction"]["prediction_confidence"] = -0.05
    with pytest.raises(ValidationError):
        OptimizationInput(**data_low)

    data_high = get_valid_input_dict()
    data_high["prediction"]["prediction_confidence"] = 1.1
    with pytest.raises(ValidationError):
        OptimizationInput(**data_high)


def test_invalid_congestion_level():
    """Test that invalid congestion levels outside LOW, MEDIUM, HIGH, CRITICAL fail validation."""
    data_bad_enum = get_valid_input_dict()
    data_bad_enum["prediction"]["predicted_congestion_level"] = "SUPER_HIGH"
    with pytest.raises(ValidationError):
        OptimizationInput(**data_bad_enum)


def test_valid_output():
    """Test that a complete valid output payload constructs OptimizationOutput successfully."""
    output_data = get_valid_output_dict()
    model = OptimizationOutput(**output_data)
    assert model.facility_id == "FAC001"
    assert model.recommended_action.type == ActionType.OPEN_COUNTER
    assert model.recommended_action.resource == "COUNTER_5"
    assert model.decision.status == DecisionStatus.RECOMMEND
    assert model.decision.score == 0.86
    assert model.fairness.fairness_score == 0.94
    assert len(model.alternatives) == 1
    assert model.alternatives[0].action == ActionType.NO_ACTION
    assert model.alternatives[0].predicted_utilization == 0.81


def test_invalid_score():
    """Test that decision score below 0 or above 1 fails validation."""
    data_low = get_valid_output_dict()
    data_low["decision"]["score"] = -0.1
    with pytest.raises(ValidationError):
        OptimizationOutput(**data_low)

    data_high = get_valid_output_dict()
    data_high["decision"]["score"] = 1.5
    with pytest.raises(ValidationError):
        OptimizationOutput(**data_high)


def test_invalid_fairness_score():
    """Test that fairness score below 0 or above 1 fails validation."""
    data_low = get_valid_output_dict()
    data_low["fairness"]["fairness_score"] = -0.2
    with pytest.raises(ValidationError):
        OptimizationOutput(**data_low)

    data_high = get_valid_output_dict()
    data_high["fairness"]["fairness_score"] = 1.2
    with pytest.raises(ValidationError):
        OptimizationOutput(**data_high)
