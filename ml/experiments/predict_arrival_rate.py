import pandas as pd


DATASET_PATH = "simulated_call_centre.csv"
FORECAST_HORIZON_MINUTES = 10


def predict_arrival_rate_per_min():
    """
    Predict the caller arrival rate for the next
    10-minute forecast horizon.

    Returns:
        float: predicted arrivals per minute
    """

    df = pd.read_csv(DATASET_PATH)

    # Convert call start time to datetime
    df["call_started"] = pd.to_datetime(
        df["date"] + " " + df["call_started"]
    )

    df = df.sort_values("call_started").reset_index(drop=True)

    # --------------------------------------------------
    # Count arrivals in consecutive 10-minute windows
    # --------------------------------------------------

    arrivals_per_window = (
        df.set_index("call_started")
        .resample("10min")
        .size()
    )

    if len(arrivals_per_window) == 0:
        return 0.0

    # --------------------------------------------------
    # Use the most recent historical windows
    # --------------------------------------------------

    recent_windows = arrivals_per_window.tail(6)

    # Average recent 10-minute arrival counts
    predicted_arrivals = recent_windows.mean()

    # Convert arrivals / 10 minutes
    # to arrivals / minute
    predicted_rate = (
        predicted_arrivals / FORECAST_HORIZON_MINUTES
    )

    return float(predicted_rate)


if __name__ == "__main__":

    rate = predict_arrival_rate_per_min()

    print("\n===== ARRIVAL RATE FORECAST =====")
    print(
        f"Forecast horizon: "
        f"{FORECAST_HORIZON_MINUTES} minutes"
    )

    print(
        f"Predicted arrival rate: "
        f"{rate:.2f} callers/minute"
    )