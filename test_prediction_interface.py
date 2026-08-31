from prediction_interface import predict_crowd


result = predict_crowd(
    current_queue_length=10,
    queue_ahead=10,
    daily_caller=50,
    hour=10,
    minute=30,
    day_of_week=2,
    recent_arrivals=5,
    recent_services=4,
    avg_service_time=200,
    time_since_previous_call=60
)


print("\n===== FINAL PERSON 3 PREDICTION =====")

for key, value in result.items():
    if key == "predicted_wait_minutes":
        print(f"{key}: {value:.2f}")
    else:
        print(f"{key}: {value}")