import os

from sklearn.model_selection import train_test_split
from ml_dataset import prepare_ml_dataset


# --------------------------------------------------
# Features required by Person 3's ML model
# --------------------------------------------------

MODEL_FEATURES = [
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

TARGET_COLUMN = "wait_length"


def split_dataset(
    file_path,
    output_directory,
    test_size=0.20,
    random_state=42
):
    """
    Prepare the full processed dataset and create
    the specific 9-feature dataset required by Person 3.

    The original processed dataset is NOT modified.
    """

    print("========================================")
    print("STARTING DATASET SPLIT")
    print("========================================")

    # --------------------------------------------------
    # 1. Load the full processed dataset
    # --------------------------------------------------

    X_full, y = prepare_ml_dataset(file_path)

    if X_full is None or y is None:
        print("ERROR: ML dataset preparation failed.")
        return False

    # --------------------------------------------------
    # 2. Check required Person 3 features
    # --------------------------------------------------

    missing_features = [
        feature
        for feature in MODEL_FEATURES
        if feature not in X_full.columns
    ]

    if missing_features:

        print("ERROR: Required Person 3 features missing:")

        for feature in missing_features:
            print(f" - {feature}")

        return False

    # --------------------------------------------------
    # 3. Select ONLY Person 3's 9 model features
    # --------------------------------------------------

    X_model = X_full[MODEL_FEATURES].copy()

    print("----------------------------------------")
    print("PERSON 3 MODEL FEATURES")
    print("----------------------------------------")

    for feature in MODEL_FEATURES:
        print(f" - {feature}")

    print("----------------------------------------")

    print(
        f"Model input features: {X_model.shape[1]}"
    )

    print(
        f"Target column: {TARGET_COLUMN}"
    )

    # --------------------------------------------------
    # 4. Split the 9-feature model dataset
    # --------------------------------------------------

    X_train, X_test, y_train, y_test = train_test_split(
        X_model,
        y,
        test_size=test_size,
        random_state=random_state
    )

    # --------------------------------------------------
    # 5. Create output directory
    # --------------------------------------------------

    os.makedirs(
        output_directory,
        exist_ok=True
    )

    # --------------------------------------------------
    # 6. Save Person 3 training data
    # --------------------------------------------------

    X_train.to_csv(
        f"{output_directory}/X_train.csv",
        index=False
    )

    y_train.to_csv(
        f"{output_directory}/y_train.csv",
        index=False
    )

    # --------------------------------------------------
    # 7. Save Person 3 testing data
    # --------------------------------------------------

    X_test.to_csv(
        f"{output_directory}/X_test.csv",
        index=False
    )

    y_test.to_csv(
        f"{output_directory}/y_test.csv",
        index=False
    )

    # --------------------------------------------------
    # 8. Display final information
    # --------------------------------------------------

    print("========================================")
    print("FINAL ML DATA SPLIT")
    print("========================================")

    print(
        f"Total samples: {len(X_model)}"
    )

    print(
        f"Training samples: {len(X_train)}"
    )

    print(
        f"Testing samples: {len(X_test)}"
    )

    print(
        f"Number of model features: {X_train.shape[1]}"
    )

    print("----------------------------------------")

    print("Training data saved:")

    print(
        f" - {output_directory}/X_train.csv"
    )

    print(
        f" - {output_directory}/y_train.csv"
    )

    print("\nTesting data saved:")

    print(
        f" - {output_directory}/X_test.csv"
    )

    print(
        f" - {output_directory}/y_test.csv"
    )

    print("========================================")
    print("DATASET SPLIT COMPLETED")
    print("========================================")

    return True


if __name__ == "__main__":

    processed_file = (
        "data/processed/processed_ml_data.csv"
    )

    output_directory = (
        "data/processed"
    )

    split_dataset(
        processed_file,
        output_directory
    )