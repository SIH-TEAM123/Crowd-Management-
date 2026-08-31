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


def test_real_person2_person3_person4_integration():

    # -----------------------------
    # Person 2 queue data
    # -----------------------------
    queue_ahead = 5
    recent_arrivals = 8
    recent_services = 6
    avg_service_time_seconds = 208.95
    wait_length_seconds = 0

    recent_window_minutes = 10

    arrival_rate_per_min = (
        recent_arrivals / recent_window_minutes
    )

    service_rate_per_counter_per_min = (
        recent_services /
        (recent_window_minutes * 2)
    )

    average_wait_minutes = (
        wait_length_seconds / 60
    )

    # Current queue length.
    # For this integration test we use the queue
    # represented by the target caller + people ahead.
    current_queue_length = queue_ahead + 1

    # -----------------------------
    # Person 3 prediction
    # -----------------------------
    predicted_queue_length = 12
    predicted_arrival_rate_per_min = 0.8
    predicted_wait_minutes = 4.791404576587278

    # Person 3 gives confidence as percentage.
    # P4 expects 0.0 - 1.0.
    prediction_confidence = 67.03 / 100

    # -----------------------------
    # Person 1 counter data
    # -----------------------------
    active_counters = 2

    # -----------------------------
    # Build P4 input
    # -----------------------------
    input_data = OptimizationInput(

        facility_id="DEMO-001",

        institution_type=None,

        timestamp=datetime.now(),

        current_state=CurrentOperationalState(
            active_counters=active_counters,

            queue_length=current_queue_length,

            arrival_rate_per_min=arrival_rate_per_min,

            service_rate_per_counter_per_min=(
                service_rate_per_counter_per_min
            ),

            average_wait_minutes=average_wait_minutes,

            utilization=0.5,

            completed_service_times=[],
        ),

        prediction=Prediction(
            forecast_horizon_minutes=10,

            predicted_queue_length=predicted_queue_length,

            predicted_arrival_rate_per_min=(
                predicted_arrival_rate_per_min
            ),

            predicted_wait_minutes=predicted_wait_minutes,

            predicted_congestion_level=(
                CongestionLevel.MEDIUM
            ),

            prediction_confidence=(
                prediction_confidence
            ),
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

    # -----------------------------
    # Run Person 4
    # -----------------------------
    result = optimize(input_data)

    # -----------------------------
    # Basic validation
    # -----------------------------
    assert result is not None

    print("\n========================================")
    print("REAL PERSON 2 → PERSON 3 → PERSON 4")
    print("INTEGRATION TEST")
    print("========================================")

    print(result)

    print("\n========================================")
    print("INTEGRATION TEST COMPLETED")
    print("========================================")