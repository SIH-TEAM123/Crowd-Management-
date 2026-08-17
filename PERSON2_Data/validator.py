import pandas as pd


REQUIRED_COLUMNS = [
    "queue_ahead",
    "daily_caller",
    "hour",
    "minute",
    "day_of_week",
    "recent_arrivals",
    "recent_services",
    "avg_service_time",
    "time_since_previous_call",
    "wait_length",
    "hour_sin",
    "hour_cos",
    "minute_sin",
    "minute_cos",
    "day_sin",
    "day_cos",
    "arrival_service_ratio",
    "queue_per_service",
    "estimated_service_load",
    "arrival_minus_service",
    "queue_arrival_ratio"
]


NUMERICAL_COLUMNS = [
    "queue_ahead",
    "daily_caller",
    "hour",
    "minute",
    "day_of_week",
    "recent_arrivals",
    "recent_services",
    "avg_service_time",
    "time_since_previous_call",
    "wait_length",
    "hour_sin",
    "hour_cos",
    "minute_sin",
    "minute_cos",
    "day_sin",
    "day_cos",
    "arrival_service_ratio",
    "queue_per_service",
    "estimated_service_load",
    "arrival_minus_service",
    "queue_arrival_ratio"
]


NON_NEGATIVE_COLUMNS = [
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


def validate_dataset(file_path):
    """
    Validate the final processed dataset.
    """

    print("========================================")
    print("STARTING DATASET VALIDATION")
    print("========================================")

    # --------------------------------------------------
    # 1. Load dataset
    # --------------------------------------------------

    try:

        df = pd.read_csv(file_path)

    except FileNotFoundError:

        print(
            f"ERROR: Dataset not found at '{file_path}'"
        )

        return False

    except Exception as e:

        print(
            f"ERROR: Could not read dataset: {e}"
        )

        return False

    # --------------------------------------------------
    # 2. Check empty dataset
    # --------------------------------------------------

    if df.empty:

        print("ERROR: Dataset is empty.")

        return False

    print(f"Rows found: {df.shape[0]}")
    print(f"Columns found: {df.shape[1]}")

    # --------------------------------------------------
    # 3. Check required columns
    # --------------------------------------------------

    missing_columns = [
        column
        for column in REQUIRED_COLUMNS
        if column not in df.columns
    ]

    if missing_columns:

        print("ERROR: Missing required columns:")

        for column in missing_columns:
            print(f" - {column}")

        return False

    print("All required columns are present.")

    # --------------------------------------------------
    # 4. Check missing values
    # --------------------------------------------------

    missing_values = (
        df[REQUIRED_COLUMNS]
        .isnull()
        .sum()
        .sum()
    )

    if missing_values > 0:

        print(
            f"ERROR: Found {missing_values} missing values."
        )

        return False

    print("No missing values found.")

    # --------------------------------------------------
    # 5. Check duplicate rows
    # --------------------------------------------------

    duplicate_count = df.duplicated().sum()

    if duplicate_count > 0:

        print(
            f"ERROR: Found {duplicate_count} duplicate rows."
        )

        return False

    print("No duplicate rows found.")

    # --------------------------------------------------
    # 6. Check negative values
    # --------------------------------------------------

    for column in NON_NEGATIVE_COLUMNS:

        if (df[column] < 0).any():

            print(
                f"ERROR: Negative values found "
                f"in '{column}'."
            )

            return False

    print(
        "No negative values found in "
        "non-negative numeric features."
    )

    # --------------------------------------------------
    # 7. Check NaN and infinite values
    # --------------------------------------------------

    numerical_data = df[NUMERICAL_COLUMNS]

    if numerical_data.isnull().any().any():

        print(
            "ERROR: Invalid NaN values found."
        )

        return False

    if not numerical_data.map(
        lambda value:
        pd.notna(value)
        and value != float("inf")
        and value != float("-inf")
    ).all().all():

        print(
            "ERROR: Invalid infinite values found."
        )

        return False

    print(
        "No NaN or infinite values found."
    )

    # --------------------------------------------------
    # 8. Validation successful
    # --------------------------------------------------

    print("========================================")
    print("DATASET VALIDATION PASSED")
    print("========================================")

    return True


if __name__ == "__main__":

    processed_file = (
        "data/processed/processed_ml_data.csv"
    )

    validate_dataset(processed_file)