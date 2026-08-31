import pandas as pd
import numpy as np


def create_features(df):
    """
    Create machine-learning features from the cleaned
    queue and call-centre dataset.
    """

    if df is None:
        print("Error: No dataset provided.")
        return None

    print("Starting feature engineering...")

    df = df.copy()

    # --------------------------------------------------
    # 1. Cyclic time features
    # --------------------------------------------------

    # Hour of the day
    df["hour_sin"] = np.sin(
        2 * np.pi * df["hour"] / 24
    )

    df["hour_cos"] = np.cos(
        2 * np.pi * df["hour"] / 24
    )

    # Minute of the hour
    df["minute_sin"] = np.sin(
        2 * np.pi * df["minute"] / 60
    )

    df["minute_cos"] = np.cos(
        2 * np.pi * df["minute"] / 60
    )

    # Day of week
    df["day_sin"] = np.sin(
        2 * np.pi * df["day_of_week"] / 7
    )

    df["day_cos"] = np.cos(
        2 * np.pi * df["day_of_week"] / 7
    )

    # --------------------------------------------------
    # 2. Arrival/service pressure
    # --------------------------------------------------

    df["arrival_service_ratio"] = (
        df["recent_arrivals"]
        / df["recent_services"].replace(0, 1)
    )

    # --------------------------------------------------
    # 3. Queue pressure
    # --------------------------------------------------

    df["queue_per_service"] = (
        df["queue_ahead"]
        / df["recent_services"].replace(0, 1)
    )

    # --------------------------------------------------
    # 4. Service workload
    # --------------------------------------------------

    df["estimated_service_load"] = (
        df["recent_services"]
        * df["avg_service_time"]
    )

    # --------------------------------------------------
    # 5. Recent traffic pressure
    # --------------------------------------------------

    df["arrival_minus_service"] = (
        df["recent_arrivals"]
        - df["recent_services"]
    )

    # --------------------------------------------------
    # 6. Queue and arrival pressure
    # --------------------------------------------------

    df["queue_arrival_ratio"] = (
        df["queue_ahead"]
        / df["recent_arrivals"].replace(0, 1)
    )

    # --------------------------------------------------
    # 7. Display summary
    # --------------------------------------------------

    print("Feature engineering completed.")

    print(f"Total rows: {len(df)}")
    print(f"Total columns: {len(df.columns)}")

    return df

if __name__ == "__main__":

    from data_loader import load_dataset
    from cleaner import clean_dataset

    df = load_dataset(
        "data/raw/ml_training_data_v2.csv"
    )

    cleaned_df = clean_dataset(df)

    feature_df = create_features(cleaned_df)

    if feature_df is not None:

        print("\nFeature-engineered dataset:")
        print(feature_df.head())

        print("\nNew feature columns:")

        original_columns = [
            "queue_ahead",
            "daily_caller",
            "hour",
            "minute",
            "day_of_week",
            "recent_arrivals",
            "recent_services",
            "avg_service_time",
            "time_since_previous_call",
            "wait_length"
        ]

        new_columns = [
            column
            for column in feature_df.columns
            if column not in original_columns
        ]

        for column in new_columns:
            print(f" - {column}")