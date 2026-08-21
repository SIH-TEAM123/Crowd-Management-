import pandas as pd

DATASET_PATH = "data/processed/processed_ml_data.csv"

QUEUE_OUTPUT_FIELDS = [
    "queue_ahead",
    "recent_arrivals",
    "recent_services",
    "avg_service_time",
    "wait_length",
    "arrival_service_ratio",
    "queue_per_service",
    "estimated_service_load",
    "arrival_minus_service",
    "queue_arrival_ratio"
]

def get_queue_data():
    """
    Return the latest available queue-related record
    from Person 2's processed dataset.

    This function does not rename or modify the
    existing Person 2 variables.
    """

    df = pd.read_csv(DATASET_PATH)

    if df.empty:
        raise ValueError("Processed dataset is empty.")

    missing_columns = [
        column
        for column in QUEUE_OUTPUT_FIELDS
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Missing required columns: {missing_columns}"
        )

    # Take the latest available row in the dataset.
    latest = df.iloc[-1]

    queue_data = {
        column: latest[column]
        for column in QUEUE_OUTPUT_FIELDS
    }

    return queue_data


if __name__ == "__main__":

    print("========================================")
    print("PERSON 4 QUEUE DATA INTERFACE")
    print("========================================")

    queue_data = get_queue_data()

    print("\nAvailable queue-state fields:")

    for field, value in queue_data.items():
        print(f"{field}: {value}")

    print("\n========================================")
    print("QUEUE DATA INTERFACE COMPLETED")
    print("========================================")