# It will tell us:

# exact raw column names
# exact processed column names
# row counts
# data types
# first 10 rows
# values of Person 4's important fields
# possible timestamp/date columns
# possible server/counter columns

import os
import pandas as pd


RAW_PATH = "data/raw/ml_training_data_v2.csv"
PROCESSED_PATH = "data/processed/processed_ml_data.csv"


IMPORTANT_FIELDS = [
    "queue_ahead",
    "recent_arrivals",
    "recent_services",
    "avg_service_time",
    "wait_length"
]


def inspect_dataset(path, name):
    print("\n")
    print("=" * 70)
    print(f"{name}")
    print("=" * 70)

    if not os.path.exists(path):
        print(f"ERROR: File not found: {path}")
        return None

    df = pd.read_csv(path)

    print(f"\nFile: {path}")
    print(f"Rows: {len(df)}")
    print(f"Columns: {len(df.columns)}")

    print("\nColumn names:")
    for column in df.columns:
        print(f" - {column}")

    print("\nData types:")
    print(df.dtypes)

    print("\nFirst 10 rows:")
    print(df.head(10).to_string(index=False))

    print("\nMissing values:")
    missing = df.isnull().sum()

    if missing.sum() == 0:
        print("No missing values.")
    else:
        print(missing[missing > 0])

    return df


def inspect_important_fields(df):
    print("\n")
    print("=" * 70)
    print("IMPORTANT PERSON 4 FIELDS")
    print("=" * 70)

    for field in IMPORTANT_FIELDS:

        if field not in df.columns:
            print(f"\n{field}: NOT PRESENT")
            continue

        print(f"\n{field}")
        print("-" * 40)

        print(f"Data type: {df[field].dtype}")
        print(f"Non-null values: {df[field].notna().sum()}")
        print(f"Unique values: {df[field].nunique()}")

        print("First 10 values:")
        print(
            df[field]
            .head(10)
            .to_string(index=False)
        )

        if pd.api.types.is_numeric_dtype(df[field]):

            print(f"Minimum: {df[field].min()}")
            print(f"Maximum: {df[field].max()}")
            print(f"Mean: {df[field].mean()}")


def find_time_columns(df):
    print("\n")
    print("=" * 70)
    print("TIME / DATE-TIME COLUMN SEARCH")
    print("=" * 70)

    possible_time_columns = []

    for column in df.columns:

        name = column.lower()

        if any(
            keyword in name
            for keyword in [
                "time",
                "date",
                "timestamp",
                "datetime"
            ]
        ):

            possible_time_columns.append(column)

    if possible_time_columns:

        print("Possible time-related columns:")

        for column in possible_time_columns:
            print(f" - {column}")

    else:

        print(
            "No obvious timestamp/date-time column found "
            "from column names."
        )


def find_server_columns(df):
    print("\n")
    print("=" * 70)
    print("SERVER / COUNTER COLUMN SEARCH")
    print("=" * 70)

    possible_server_columns = []

    for column in df.columns:

        name = column.lower()

        if any(
            keyword in name
            for keyword in [
                "counter",
                "server",
                "agent",
                "desk",
                "staff",
                "operator"
            ]
        ):

            possible_server_columns.append(column)

    if possible_server_columns:

        print("Possible server/counter columns:")

        for column in possible_server_columns:
            print(f" - {column}")

    else:

        print(
            "No obvious active-counter/server/agent column "
            "found from column names."
        )


def inspect_processed_features(df):
    print("\n")
    print("=" * 70)
    print("PROCESSED DATASET FEATURES")
    print("=" * 70)

    print(
        f"Processed rows: {len(df)}"
    )

    print(
        f"Processed columns: {len(df.columns)}"
    )

    print("\nProcessed columns:")

    for column in df.columns:
        print(f" - {column}")


def main():

    print("=" * 70)
    print("PERSON 4 DATA DEFINITION AUDIT")
    print("=" * 70)

    raw_df = inspect_dataset(
        RAW_PATH,
        "RAW DATASET"
    )

    processed_df = inspect_dataset(
        PROCESSED_PATH,
        "PROCESSED DATASET"
    )

    if raw_df is None:
        print("\nCannot continue without raw dataset.")
        return

    inspect_important_fields(raw_df)

    find_time_columns(raw_df)

    find_server_columns(raw_df)

    if processed_df is not None:
        inspect_processed_features(processed_df)

    print("\n")
    print("=" * 70)
    print("AUDIT COMPLETED")
    print("=" * 70)


if __name__ == "__main__":
    main()