import joblib
import pandas as pd

# 1. Load trained V3 model


MODEL_PATH = "crowd_wait_model_v3.pkl"

model = joblib.load(MODEL_PATH)

# V3 feature list

FEATURES = [
    "queue_ahead",
    "daily_caller",
    "hour",
    "minute",
    "day_of_week",
    "recent_arrivals",
    "recent_services",
    "avg_service_time",
    "time_since_previous_call"
]
# Prediction function
def predict_wait(
    queue_ahead,
    daily_caller,
    hour,
    minute,
    day_of_week,
    recent_arrivals,
    recent_services,
    avg_service_time,
    time_since_previous_call
):
    """
    Predict waiting time in seconds using the trained V3 model.
    """

    data = pd.DataFrame([{
        "queue_ahead": queue_ahead,
        "daily_caller": daily_caller,
        "hour": hour,
        "minute": minute,
        "day_of_week": day_of_week,
        "recent_arrivals": recent_arrivals,
        "recent_services": recent_services,
        "avg_service_time": avg_service_time,
        "time_since_previous_call": time_since_previous_call
    }])
    prediction = model.predict(data[FEATURES])[0]

    # Waiting time cannot be negative
    prediction = max(0, prediction)

    return prediction


#  Simple test


if __name__ == "__main__":

    predicted_wait = predict_wait(
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

    print("\n===== V3 PREDICTION =====")
    print(f"Predicted waiting time: {predicted_wait:.2f} seconds")