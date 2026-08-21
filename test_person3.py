from datetime import datetime

from person3.data_model import CrowdInput
from predictor import predict_crowd


# Sample crowd data
crowd_data = CrowdInput(
    queue_length=40,
    people_arriving=15,
    people_served=8,
    average_service_time=2.0,
    current_waiting_time=10.0,
    timestamp=datetime.now()
)


# Generate prediction
prediction = predict_crowd(
    crowd_data,
    prediction_minutes=20
)


# Display results
print("\n===== PERSON 3 CROWD PREDICTION =====")

print("Current queue:", crowd_data.queue_length)

print("Predicted queue:", prediction.predicted_queue)

print("Predicted waiting time:",
      prediction.predicted_wait_time, "minutes")

print("Crowd level:", prediction.crowd_level)

print("Congestion risk:", prediction.congestion_risk)

print("Recommended action:",
      prediction.recommended_action)