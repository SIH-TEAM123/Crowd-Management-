from datetime import datetime

from data_model import CrowdInput
from predictor import predict_wait


# --------------------------------------------------
# Create sample crowd input
# --------------------------------------------------

crowd_input = CrowdInput(
    timestamp=datetime.now(),
    queue_length=20,
    average_service_time=300
)


# --------------------------------------------------
# Run V3 prediction
# --------------------------------------------------

result = predict_wait(
    crowd_input=crowd_input,
    daily_caller=100,
    recent_arrivals=8,
    recent_services=5,
    time_since_previous_call=60
)


# --------------------------------------------------
# Display result
# --------------------------------------------------

print("\n===== V3 PREDICTION TEST =====")

print("Predicted queue      :", result.predicted_queue)
print("Predicted wait time  :", result.predicted_wait_time)
print("Crowd level          :", result.crowd_level)
print("Congestion risk      :", result.congestion_risk)
print("Recommended action   :", result.recommended_action)