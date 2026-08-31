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


input_data = OptimizationInput(
    facility_id="DEMO-001",
    institution_type="hospital",
    timestamp=datetime.now(),

    current_state=CurrentOperationalState(
        active_counters=2,
        queue_length=10,
        arrival_rate_per_min=0.8,
        service_rate_per_counter_per_min=0.3,
        average_wait_minutes=4.79,
        utilization=0.85,
        completed_service_times=[
            8.0,
            8.5,
            9.0,
            8.2,
            8.7,
        ],
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
        time_critical_users=2,
        vulnerable_users=3,
    ),
)


result = optimize(input_data)

print("\n========================================")
print("PERSON 4 OPTIMIZER MANUAL TEST")
print("========================================")

print("\nOptimizationOutput fields:")
print(result.model_dump())

print("\n========================================")
print("PERSON 4 MANUAL TEST COMPLETED")
print("========================================")