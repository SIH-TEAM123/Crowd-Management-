import pandas as pd


DATASET_PATH = "simulated_call_centre.csv"
FORECAST_HORIZON_MINUTES = 10


def predict_service_rate_per_min():
    """
    Estimate the service completion rate for the
    next 10-minute forecast horizon.

    Returns:
        float: predicted services per minute
    """

    df = pd.read_csv(DATASET_PATH)

    # Convert answer time to datetime
    df["call_answered"] = pd.to_datetime(
        df["date"] + " " + df["call_answered"]
    )

    df = df.sort_values("call_answered").reset_index(drop=True)

    # Count completed/answered calls in 10-minute windows
    services_per_window = (
        df.set_index("call_answered")
        .resample("10min")
        .size()
    )

    if len(services_per_window) == 0:
        return 0.0

    # Use the six most recent historical windows
    recent_windows = services_per_window.tail(6)

    predicted_services = recent_windows.mean()

    # Convert services / 10 minutes
    # to services / minute
    predicted_rate = (
        predicted_services / FORECAST_HORIZON_MINUTES
    )

    return float(predicted_rate)


if __name__ == "__main__":

    rate = predict_service_rate_per_min()

    print("\n===== SERVICE RATE FORECAST =====")
    print(
        f"Forecast horizon: "
        f"{FORECAST_HORIZON_MINUTES} minutes"
    )

    print(
        f"Predicted service rate: "
        f"{rate:.2f} services/minute"
    )