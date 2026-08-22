import joblib
import pandas as pd
from app.services.person3.prediction_interface import predict_crowd


def get_person3_prediction(
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
):
    """
    Convert Person 3 V3 prediction output
    into the structure expected by Person 4.
    """

    result = predict_crowd(
        current_queue_length=current_queue_length,
        queue_ahead=queue_ahead,
        daily_caller=daily_caller,
        hour=hour,
        minute=minute,
        day_of_week=day_of_week,
        recent_arrivals=recent_arrivals,
        recent_services=recent_services,
        avg_service_time=avg_service_time,
        time_since_previous_call=time_since_previous_call,
    )

    return {
        "forecast_horizon_minutes": int(
            result["forecast_horizon_minutes"]
        ),
        "predicted_queue_length": int(
            round(result["predicted_queue_length"])
        ),
        "predicted_arrival_rate_per_min": float(
            result["predicted_arrival_rate_per_min"]
        ),
        "predicted_wait_minutes": float(
            result["predicted_wait_minutes"]
        ),
        "predicted_congestion_level": str(
            result["predicted_congestion_level"]
        ),
        "prediction_confidence": float(
            result["prediction_confidence"]
        )/100.0,
    }


if __name__ == "__main__":
    print("=" * 40)
    print("PERSON 3 → PERSON 4 PREDICTION ADAPTER")
    print("=" * 40)

    prediction = get_person3_prediction(
        current_queue_length=10,
        queue_ahead=5,
        daily_caller=50,
        hour=11,
        minute=30,
        day_of_week=1,
        recent_arrivals=8,
        recent_services=6,
        avg_service_time=208.95,
        time_since_previous_call=2,
    )

    print("\nAdapted prediction:")

    for key, value in prediction.items():
        print(f"{key}: {value}")

    print("\n" + "=" * 40)
    print("PERSON 3 → PERSON 4 ADAPTER COMPLETED")
    print("=" * 40)