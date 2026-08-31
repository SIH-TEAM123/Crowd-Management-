FORECAST_HORIZON_MINUTES = 10


def predict_queue_length(
    current_queue_length,
    predicted_arrival_rate_per_min,
    predicted_service_rate_per_min,
    forecast_horizon_minutes=FORECAST_HORIZON_MINUTES
):
    """
    Estimate the queue length at the end of the forecast horizon.

    Parameters
    ----------
    current_queue_length : int or float
        Number of callers currently waiting.
        Unit: callers

    predicted_arrival_rate_per_min : float
        Expected caller arrival rate.
        Unit: callers/minute

    predicted_service_rate_per_min : float
        Expected service completion rate.
        Unit: callers/minute

    forecast_horizon_minutes : int or float
        Forecast period.
        Unit: minutes

    Returns
    -------
    float
        Predicted queue length at the end of the forecast horizon.
        Unit: callers
    """

    # Expected arrivals during the forecast period
    predicted_arrivals = (
        predicted_arrival_rate_per_min
        * forecast_horizon_minutes
    )

    # Expected services during the forecast period
    predicted_services = (
        predicted_service_rate_per_min
        * forecast_horizon_minutes
    )

    # Queue balance equation
    predicted_queue = (
        current_queue_length
        + predicted_arrivals
        - predicted_services
    )

    # A queue cannot have a negative number of callers
    predicted_queue = max(0.0, predicted_queue)

    return predicted_queue


# --------------------------------------------------
# Test
# --------------------------------------------------

if __name__ == "__main__":

    current_queue = 10

    arrival_rate = 0.42

    service_rate = 0.30

    predicted_queue = predict_queue_length(
        current_queue_length=current_queue,
        predicted_arrival_rate_per_min=arrival_rate,
        predicted_service_rate_per_min=service_rate,
        forecast_horizon_minutes=10
    )

    print("\n===== QUEUE LENGTH FORECAST =====")

    print(
        f"Current queue: "
        f"{current_queue:.0f} callers"
    )

    print(
        f"Predicted arrival rate: "
        f"{arrival_rate:.2f} callers/minute"
    )

    print(
        f"Predicted service rate: "
        f"{service_rate:.2f} callers/minute"
    )

    print(
        f"Forecast horizon: "
        f"{10} minutes"
    )

    print(
        f"Predicted queue length: "
        f"{predicted_queue:.2f} callers"
    )