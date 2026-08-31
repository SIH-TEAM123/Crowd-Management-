import joblib
import pandas as pd


# --------------------------------------------------
# 1. Load trained V3 model
# --------------------------------------------------

MODEL_PATH = "crowd_wait_model_v3.pkl"

model = joblib.load(MODEL_PATH)


# --------------------------------------------------
# 2. V3 features
# --------------------------------------------------

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


# --------------------------------------------------
# 3. Prediction function
# --------------------------------------------------

def predict_wait_time(
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
    Predict waiting time using the trained V3 model.

    Returns:
        predicted_wait_minutes: float
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

    # Predict wait time in seconds
    predicted_wait_seconds = model.predict(data[FEATURES])[0]

    # Waiting time cannot be negative
    predicted_wait_seconds = max(0, predicted_wait_seconds)

    # Convert seconds → minutes
    predicted_wait_minutes = predicted_wait_seconds / 60

    return predicted_wait_minutes


# --------------------------------------------------
# 4. Simple test
# --------------------------------------------------

if __name__ == "__main__":

    predicted_wait = predict_wait_time(
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

    print("\n===== WAIT TIME PREDICTION =====")
    print(f"Predicted waiting time: {predicted_wait:.2f} minutes")