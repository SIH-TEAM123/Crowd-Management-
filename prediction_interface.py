import joblib
import pandas as pd


# ==================================================
# Configuration
# ==================================================

MODEL_PATH = "crowd_wait_model_v3.pkl"

FORECAST_HORIZON_MINUTES = 10

# V3 validation R²
MODEL_R2 = 0.6703


# ==================================================
# Load V3 model
# ==================================================

model = joblib.load(MODEL_PATH)


# ==================================================
# V3 feature list
# ==================================================

V3_FEATURES = [
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


# ==================================================
# Arrival-rate forecast
# ==================================================

def predict_arrival_rate_per_min(
    recent_arrivals,
    recent_window_minutes=10
):
    """
    Estimate arrival rate from recent observed arrivals.

    Parameters
    ----------
    recent_arrivals : int or float
        Number of callers who arrived during the recent window.
        Unit: callers

    recent_window_minutes : int or float
        Duration of the observation window.
        Unit: minutes

    Returns
    -------
    float
        Arrival rate.
        Unit: callers/minute
    """

    if recent_window_minutes <= 0:
        raise ValueError("recent_window_minutes must be positive")

    return float(
        recent_arrivals / recent_window_minutes
    )


# ==================================================
# Service-rate forecast
# ==================================================

def predict_service_rate_per_min(
    recent_services,
    recent_window_minutes=10
):
    """
    Estimate service rate from recently completed services.

    Parameters
    ----------
    recent_services : int or float
        Number of services completed during the recent window.
        Unit: callers/services

    recent_window_minutes : int or float
        Duration of the observation window.
        Unit: minutes

    Returns
    -------
    float
        Service rate.
        Unit: services/minute
    """

    if recent_window_minutes <= 0:
        raise ValueError("recent_window_minutes must be positive")

    return float(
        recent_services / recent_window_minutes
    )


# ==================================================
# Queue forecast
# ==================================================

def predict_queue_length(
    current_queue_length,
    predicted_arrival_rate_per_min,
    predicted_service_rate_per_min,
    forecast_horizon_minutes=FORECAST_HORIZON_MINUTES
):
    """
    Estimate queue length at the end of the forecast horizon.

    Units:
        queue length -> callers
        rates -> callers/minute
        horizon -> minutes
    """

    predicted_arrivals = (
        predicted_arrival_rate_per_min
        * forecast_horizon_minutes
    )

    predicted_services = (
        predicted_service_rate_per_min
        * forecast_horizon_minutes
    )

    predicted_queue = (
        current_queue_length
        + predicted_arrivals
        - predicted_services
    )

    return max(0.0, float(predicted_queue))


# ==================================================
# V3 ML wait-time prediction
# ==================================================

def predict_wait_minutes(
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
    Use the trained V3 ML model to predict waiting time.

    The V3 model predicts seconds internally.
    This function converts the result to minutes.

    Returns:
        float: predicted waiting time in minutes
    """

    model_input = pd.DataFrame([{
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

    predicted_wait_seconds = model.predict(
        model_input[V3_FEATURES]
    )[0]

    predicted_wait_seconds = max(
        0.0,
        float(predicted_wait_seconds)
    )

    return predicted_wait_seconds / 60.0


# ==================================================
# Congestion classification
# ==================================================

def predict_congestion_level(predicted_queue_length):
    """
    Classify predicted queue congestion.

    Returns:
        LOW
        MEDIUM
        HIGH
        CRITICAL
    """

    if predicted_queue_length < 5:
        return "LOW"

    elif predicted_queue_length < 15:
        return "MEDIUM"

    elif predicted_queue_length < 30:
        return "HIGH"

    else:
        return "CRITICAL"


# ==================================================
# Model-level confidence
# ==================================================

def get_prediction_confidence():
    """
    Return the V3 model-level confidence indicator.

    This is based on the V3 validation R².
    It is NOT a calibrated probability for an
    individual prediction.

    Returns:
        float: percentage
    """

    return round(MODEL_R2 * 100, 2)


# ==================================================
# FINAL PERSON 4 INTERFACE
# ==================================================

def predict_crowd(
    current_queue_length,
    queue_ahead,
    daily_caller,
    hour,
    minute,
    day_of_week,
    recent_arrivals,
    recent_services,
    avg_service_time,
    time_since_previous_call,
    recent_window_minutes=10
):
    """
    Main Person 3 → Person 4 prediction interface.

    Parameters
    ----------
    current_queue_length : int/float
        Current number of callers waiting.
        Unit: callers

    queue_ahead : int/float
        Number of callers ahead of the target caller.
        Unit: callers

    daily_caller : int
        Daily caller position/count used by V3.
        Unit: callers

    hour : int
        Hour of the call timestamp.
        Unit: hour, 0-23

    minute : int
        Minute of the call timestamp.
        Unit: minute, 0-59

    day_of_week : int
        Day index used during V3 training.
        Unit: day index

    recent_arrivals : int/float
        Callers arriving during the recent observation window.
        Unit: callers

    recent_services : int/float
        Services completed during the recent observation window.
        Unit: services/callers

    avg_service_time : int/float
        Average service duration.
        Unit: seconds

    time_since_previous_call : int/float
        Time since the previous call.
        Unit: seconds

    recent_window_minutes : int/float
        Observation window for arrival/service rates.
        Unit: minutes

    Returns
    -------
    dict
        Person 4 prediction interface.
    """

    # --------------------------------------------------
    # 1. Forecast horizon
    # --------------------------------------------------

    forecast_horizon_minutes = FORECAST_HORIZON_MINUTES


    # --------------------------------------------------
    # 2. Predicted arrival rate
    # --------------------------------------------------

    predicted_arrival_rate_per_min = (
        predict_arrival_rate_per_min(
            recent_arrivals,
            recent_window_minutes
        )
    )


    # --------------------------------------------------
    # 3. Predicted service rate
    # --------------------------------------------------

    predicted_service_rate_per_min = (
        predict_service_rate_per_min(
            recent_services,
            recent_window_minutes
        )
    )


    # --------------------------------------------------
    # 4. Predicted queue
    # --------------------------------------------------

    predicted_queue_length = predict_queue_length(
        current_queue_length=current_queue_length,
        predicted_arrival_rate_per_min=(
            predicted_arrival_rate_per_min
        ),
        predicted_service_rate_per_min=(
            predicted_service_rate_per_min
        ),
        forecast_horizon_minutes=(
            forecast_horizon_minutes
        )
    )


    # --------------------------------------------------
    # 5. V3 ML predicted wait
    # --------------------------------------------------

    predicted_wait_minutes = predict_wait_minutes(
        queue_ahead=queue_ahead,
        daily_caller=daily_caller,
        hour=hour,
        minute=minute,
        day_of_week=day_of_week,
        recent_arrivals=recent_arrivals,
        recent_services=recent_services,
        avg_service_time=avg_service_time,
        time_since_previous_call=time_since_previous_call
    )


    # --------------------------------------------------
    # 6. Congestion
    # --------------------------------------------------

    predicted_congestion_level = (
        predict_congestion_level(
            predicted_queue_length
        )
    )


    # --------------------------------------------------
    # 7. Confidence
    # --------------------------------------------------

    prediction_confidence = (
        get_prediction_confidence()
    )


    # --------------------------------------------------
    # Final output
    # --------------------------------------------------

    return {
        "forecast_horizon_minutes":
            forecast_horizon_minutes,

        "predicted_queue_length":
            predicted_queue_length,

        "predicted_arrival_rate_per_min":
            predicted_arrival_rate_per_min,

        "predicted_wait_minutes":
            predicted_wait_minutes,

        "predicted_congestion_level":
            predicted_congestion_level,

        "prediction_confidence":
            prediction_confidence
    }