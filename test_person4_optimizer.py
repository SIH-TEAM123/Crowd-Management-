from datetime import datetime

from app.services.person4.models.input_models import (
    OptimizationInput,
    CurrentOperationalState,
    Prediction,
    ResourceState,
    PriorityInfo,
    CongestionLevel,
)
from app.services.person4.optimizer.optimizer import optimize


current_state = CurrentOperationalState(
    active_counters=4,
    queue_length=0,
    arrival_rate_per_min=0.4,
    service_rate_per_counter_per_min=0.1,
    average_wait_minutes=0.0,
    utilization=1.0,
    completed_service_times=[],
)

prediction = Prediction(
    forecast_horizon_minutes=10,
    predicted_queue_length=2,
    predicted_arrival_rate_per_min=0.5,
    predicted_wait_minutes=2.0,
    predicted_congestion_level=CongestionLevel.MEDIUM,
    prediction_confidence=0.80,
)

resources = ResourceState(
    spare_counters=1,
    reallocatable_resources=2,
)

priority = PriorityInfo(
    time_critical_users=0,
    vulnerable_users=0,
)

input_data = OptimizationInput(
    facility_id="TEST_FACILITY",
    institution_type="TEST",
    timestamp=datetime.now(),
    current_state=current_state,
    prediction=prediction,
    resources=resources,
    priority=priority,
)

result = optimize(input_data)

print("\n========== PERSON 4 OPTIMIZER RESULT ==========")
print(result.model_dump())
print("===============================================")