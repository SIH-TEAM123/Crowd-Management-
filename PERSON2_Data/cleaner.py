import pandas as pd


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
    "wait_length"
]


def clean_dataset(df):
    """
    Clean the real crowd/queue dataset.

    Operations:
    1. Remove duplicate rows
    2. Convert required columns to numeric
    3. Handle missing numerical values
    4. Remove invalid rows
    5. Check for negative values
    """

    if df is None:
        print("Error: No dataset provided.")
        return None

    print("Starting data cleaning...")

    df = df.copy()

    # --------------------------------------------------
    # 1. Check required columns
    # --------------------------------------------------

    missing_columns = [
        column
        for column in NUMERICAL_COLUMNS
        if column not in df.columns
    ]

    if missing_columns:
        print("ERROR: Missing required columns:")

        for column in missing_columns:
            print(f" - {column}")

        return None

    # --------------------------------------------------
    # 2. Remove duplicate rows
    # --------------------------------------------------

    duplicate_count = df.duplicated().sum()

    if duplicate_count > 0:

        df = df.drop_duplicates()

        print(
            f"Removed {duplicate_count} duplicate rows."
        )

    else:

        print("No duplicate rows found.")

    # --------------------------------------------------
    # 3. Convert numerical columns
    # --------------------------------------------------

    for column in NUMERICAL_COLUMNS:

        df[column] = pd.to_numeric(
            df[column],
            errors="coerce"
        )

    # --------------------------------------------------
    # 4. Check missing values
    # --------------------------------------------------

    missing_before = df[NUMERICAL_COLUMNS].isnull().sum().sum()

    if missing_before > 0:

        print(
            f"Found {missing_before} missing values."
        )

        for column in NUMERICAL_COLUMNS:

            median_value = df[column].median()

            df[column] = df[column].fillna(
                median_value
            )

        print("Missing values filled using column medians.")

    else:

        print("No missing values found.")

    # --------------------------------------------------
    # 5. Remove negative values
    # --------------------------------------------------

    negative_count = 0

    for column in NUMERICAL_COLUMNS:

        negative_rows = (df[column] < 0).sum()

        negative_count += negative_rows

    if negative_count > 0:

        print(
            f"Found {negative_count} negative values."
        )

        for column in NUMERICAL_COLUMNS:

            df = df[df[column] >= 0]

        print("Invalid negative-value rows removed.")

    else:

        print("No negative values found.")

    # --------------------------------------------------
    # 6. Final validation
    # --------------------------------------------------

    if df.empty:

        print(
            "ERROR: Dataset became empty after cleaning."
        )

        return None

    print("Data cleaning completed.")

    print(f"Remaining rows: {len(df)}")
    print(f"Remaining columns: {len(df.columns)}")

    return df


if __name__ == "__main__":

    from data_loader import load_dataset

    df = load_dataset(
        "data/raw/ml_training_data_v2.csv"
    )

    cleaned_df = clean_dataset(df)

    if cleaned_df is not None:

        print("\nCleaned dataset:")
        print(cleaned_df.head())

        print("\nData types:")
        print(cleaned_df.dtypes)