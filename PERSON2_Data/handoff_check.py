import os
import pandas as pd


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


TRAIN_X = "data/processed/X_train.csv"
TRAIN_Y = "data/processed/y_train.csv"
TEST_X = "data/processed/X_test.csv"
TEST_Y = "data/processed/y_test.csv"

FULL_DATASET = "data/processed/processed_ml_data.csv"


def check_file(path):
    """Check that a required file exists."""

    if not os.path.exists(path):
        print(f"ERROR: Missing file: {path}")
        return False

    print(f"OK: {path}")
    return True


def check_model_dataset(x_path, y_path, expected_rows):
    """Validate one X/y dataset pair."""

    X = pd.read_csv(x_path)
    y = pd.read_csv(y_path)

    # Check feature columns
    if list(X.columns) != MODEL_FEATURES:

        print(
            f"ERROR: Incorrect feature columns in {x_path}"
        )

        print("Expected:")
        print(MODEL_FEATURES)

        print("Received:")
        print(list(X.columns))

        return False

    # Check target column
    if list(y.columns) != [TARGET_COLUMN]:

        print(
            f"ERROR: Incorrect target column in {y_path}"
        )

        return False

    # Check dimensions
    if len(X) != expected_rows:

        print(
            f"ERROR: Incorrect number of rows in {x_path}"
        )

        return False

    if len(y) != expected_rows:

        print(
            f"ERROR: Incorrect number of rows in {y_path}"
        )

        return False

    # Check X/y alignment
    if len(X) != len(y):

        print(
            "ERROR: X and y row counts do not match."
        )

        return False

    print(
        f"OK: {x_path} → {X.shape}"
    )

    print(
        f"OK: {y_path} → {y.shape}"
    )

    return True


if __name__ == "__main__":

    print("========================================")
    print("FINAL PERSON 2 → PERSON 3 HANDOFF CHECK")
    print("========================================")

    print("\nChecking required files...")

    files_ok = all([
        check_file(TRAIN_X),
        check_file(TRAIN_Y),
        check_file(TEST_X),
        check_file(TEST_Y),
        check_file(FULL_DATASET)
    ])

    if not files_ok:

        print("\nHANDOFF CHECK FAILED")
        raise SystemExit(1)

    print("\nChecking full processed dataset...")

    full_df = pd.read_csv(FULL_DATASET)

    if full_df.shape != (51708, 21):

        print(
            "ERROR: Full processed dataset has "
            f"unexpected shape: {full_df.shape}"
        )

        raise SystemExit(1)

    print(
        f"OK: Full dataset → {full_df.shape}"
    )

    print("\nChecking training dataset...")

    train_ok = check_model_dataset(
        TRAIN_X,
        TRAIN_Y,
        41366
    )

    print("\nChecking testing dataset...")

    test_ok = check_model_dataset(
        TEST_X,
        TEST_Y,
        10342
    )

    print("\n========================================")

    if train_ok and test_ok:

        print(
            "PERSON 2 → PERSON 3 HANDOFF CHECK PASSED"
        )

        print("========================================")

    else:

        print(
            "PERSON 2 → PERSON 3 HANDOFF CHECK FAILED"
        )

        print("========================================")

        raise SystemExit(1)