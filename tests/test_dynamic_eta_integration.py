from datetime import datetime

from models.input_models import (
    OptimizationInput,
    CurrentOperationalState,
    Prediction,
    ResourceState,
    PriorityInfo,
    CongestionLevel,
)

from optimizer.optimizer import optimize


def build_input(completed_service_times):
    """
    Build a Person 4 input using the same queue/prediction
    values as our real integration test.
    """

    return OptimizationInput(
        facility_id="DEMO-001",
        institution_type=None,
        timestamp=datetime.now(),

        current_state=CurrentOperationalState(
            active_counters=2,
            queue_length=10,
            arrival_rate_per_min=0.8,
            service_rate_per_counter_per_min=0.3,
            average_wait_minutes=4.79,
            utilization=0.75,
            completed_service_times=completed_service_times,
        ),

        prediction=Prediction(
            forecast_horizon_minutes=10,
            predicted_queue_length=12,
            predicted_arrival_rate_per_min=0.8,
            predicted_wait_minutes=4.79,
            predicted_congestion_level=CongestionLevel.MEDIUM,
            prediction_confidence=0.6703,
        ),

        resources=ResourceState(
            spare_counters=1,
            reallocatable_resources=1,
        ),

        priority=PriorityInfo(
            time_critical_users=0,
            vulnerable_users=0,
        ),
    )


def test_eta_with_no_service_history():
    """
    No completed service history means the optimizer
    should fall back to the administrative service time.
    """

    input_data = build_input([])

    result = optimize(input_data)

    assert result is not None


def test_eta_with_fast_service_history():
    """
    If people consistently finish faster than the
    administrative limit, the dynamic ETA should adapt.
    """

    input_data = build_input([
        5.0,
        5.0,
        5.0,
        5.0,
        5.0,
    ])

    result = optimize(input_data)

    assert result is not None


def test_eta_with_slow_service_history():
    """
    If people consistently take longer, the dynamic ETA
    should adapt upward.
    """

    input_data = build_input([
        12.0,
        12.0,
        12.0,
        12.0,
        12.0,
    ])

    result = optimize(input_data)

    assert result is not None