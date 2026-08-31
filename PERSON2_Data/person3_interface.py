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


def load_training_data():
    """
    Load the training data prepared for Person 3.
    """

    X_train = pd.read_csv(
        "data/processed/X_train.csv"
    )

    y_train = pd.read_csv(
        "data/processed/y_train.csv"
    )

    return X_train, y_train


def load_testing_data():
    """
    Load the testing data prepared for Person 3.
    """

    X_test = pd.read_csv(
        "data/processed/X_test.csv"
    )

    y_test = pd.read_csv(
        "data/processed/y_test.csv"
    )

    return X_test, y_test


def validate_model_interface(X, y):
    """
    Verify that the data matches Person 3's
    expected model interface.
    """

    # Check feature columns
    if list(X.columns) != MODEL_FEATURES:

        print("ERROR: Feature order does not match.")

        print("\nExpected:")
        print(MODEL_FEATURES)

        print("\nReceived:")
        print(list(X.columns))

        return False

    # Check target
    if TARGET_COLUMN not in y.columns:

        print(
            f"ERROR: Target column "
            f"'{TARGET_COLUMN}' not found."
        )

        return False

    # Check row counts
    if len(X) != len(y):

        print(
            "ERROR: X and y have different "
            "numbers of rows."
        )

        return False

    print("Person 3 model interface validated.")

    print(
        f"Features: {X.shape[1]}"
    )

    print(
        f"Samples: {len(X)}"
    )

    print(
        f"Target: {TARGET_COLUMN}"
    )

    return True

def prepare_prediction_input(data):
    """
    Prepare one or more new observations for Person 3's model.

    The input must contain exactly the 9 model features.
    """

    if not isinstance(data, pd.DataFrame):

        print(
            "ERROR: Prediction input must be a pandas DataFrame."
        )

        return None

    missing_features = [
        feature
        for feature in MODEL_FEATURES
        if feature not in data.columns
    ]

    if missing_features:

        print("ERROR: Missing prediction features:")

        for feature in missing_features:
            print(f" - {feature}")

        return None

    prediction_data = data[MODEL_FEATURES].copy()

    print(
        f"Prediction input prepared: "
        f"{prediction_data.shape[0]} sample(s), "
        f"{prediction_data.shape[1]} feature(s)"
    )

    return prediction_data

if __name__ == "__main__":

    print("========================================")
    print("PERSON 3 INTERFACE TEST")
    print("========================================")

    X_train, y_train = load_training_data()

    X_test, y_test = load_testing_data()

    print("\nTraining data:")
    print(
        f"X_train: {X_train.shape}"
    )
    print(
        f"y_train: {y_train.shape}"
    )

    print("\nTesting data:")
    print(
        f"X_test: {X_test.shape}"
    )
    print(
        f"y_test: {y_test.shape}"
    )

    print("\nValidating training interface...")

    training_valid = validate_model_interface(
        X_train,
        y_train
    )

    print("\nValidating testing interface...")

    testing_valid = validate_model_interface(
        X_test,
        y_test
    )

    print("\n========================================")

    if training_valid and testing_valid:

        print(
            "PERSON 3 INTERFACE VALIDATION PASSED"
        )

    else:

        print(
            "PERSON 3 INTERFACE VALIDATION FAILED"
        )

    print("========================================")