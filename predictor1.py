import os

# Prevent joblib/loky CPU detection warning
os.environ["LOKY_MAX_CPU_COUNT"] = str(os.cpu_count() or 1)

import warnings
warnings.filterwarnings(
    "ignore",
    message="Could not find the number of physical cores"
)

import joblib
import pandas as pd

from data_model import CrowdInput, CrowdPrediction


# --------------------------------------------------
# Load trained V3 model
# --------------------------------------------------

MODEL_PATH = "crowd_wait_model_v3.pkl"

model = joblib.load(MODEL_PATH)


# --------------------------------------------------
# V3 prediction function
# --------------------------------------------------

def predict_wait(
    crowd_input: CrowdInput,
    daily_caller: int,
    recent_arrivals: float,
    recent_services: float,
    time_since_previous_call: float
) -> CrowdPrediction:

    """
    Convert CrowdInput into the feature format expected
    by the V3 ML model and generate a crowd prediction.
    """

    # Extract date/time information
    timestamp = crowd_input.timestamp

    hour = timestamp.hour
    minute = timestamp.minute
    day_of_week = timestamp.weekday()


    # --------------------------------------------------
    # Prepare V3 model input
    # --------------------------------------------------

    model_input = pd.DataFrame([{
        "queue_ahead": crowd_input.queue_length,
        "daily_caller": daily_caller,
        "hour": hour,
        "minute": minute,
        "day_of_week": day_of_week,
        "recent_arrivals": recent_arrivals,
        "recent_services": recent_services,
        "avg_service_time": crowd_input.average_service_time,
        "time_since_previous_call": time_since_previous_call
    }])


    # --------------------------------------------------
    # Predict waiting time
    # --------------------------------------------------

    predicted_wait = model.predict(model_input)[0]

    # Waiting time cannot be negative
    predicted_wait = max(0.0, float(predicted_wait))


    # --------------------------------------------------
    # Estimate predicted queue
    # --------------------------------------------------

    predicted_queue = max(
        0,
        int(round(
            crowd_input.queue_length
            + recent_arrivals
            - recent_services
        ))
    )


    # --------------------------------------------------
    # Determine crowd level
    # --------------------------------------------------

    if predicted_queue <= 5:
        crowd_level = "LOW"

    elif predicted_queue <= 15:
        crowd_level = "MEDIUM"

    else:
        crowd_level = "HIGH"


    # --------------------------------------------------
    # Determine congestion risk
    # --------------------------------------------------

    if predicted_wait < 30:
        congestion_risk = "LOW"

    elif predicted_wait < 120:
        congestion_risk = "MEDIUM"

    else:
        congestion_risk = "HIGH"


    # --------------------------------------------------
    # Recommended action
    # --------------------------------------------------

    if congestion_risk == "LOW":
        recommended_action = "Normal operation"

    elif congestion_risk == "MEDIUM":
        recommended_action = "Monitor queue and consider additional service capacity"

    else:
        recommended_action = "Deploy additional service capacity immediately"


    # --------------------------------------------------
    # Return Person 3 output
    # --------------------------------------------------

    return CrowdPrediction(
        predicted_queue=predicted_queue,
        predicted_wait_time=predicted_wait,
        crowd_level=crowd_level,
        congestion_risk=congestion_risk,
        recommended_action=recommended_action
    )