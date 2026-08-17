import pandas as pd


TARGET_COLUMN = "wait_length"


def prepare_ml_dataset(file_path):
    """
    Prepare the processed dataset for machine learning.

    X = input features
    y = target variable
    """

    print("========================================")
    print("PREPARING ML DATASET")
    print("========================================")

    # --------------------------------------------------
    # 1. Load processed dataset
    # --------------------------------------------------

    try:

        df = pd.read_csv(file_path)

    except FileNotFoundError:

        print(
            f"ERROR: File not found: {file_path}"
        )

        return None, None

    except Exception as e:

        print(
            f"ERROR: Could not load dataset: {e}"
        )

        return None, None

    # --------------------------------------------------
    # 2. Check target column
    # --------------------------------------------------

    if TARGET_COLUMN not in df.columns:

        print(
            f"ERROR: Target column "
            f"'{TARGET_COLUMN}' not found."
        )

        return None, None

    # --------------------------------------------------
    # 3. Define columns that must not be inputs
    # --------------------------------------------------

    columns_to_remove = [
        TARGET_COLUMN
    ]

    # --------------------------------------------------
    # 4. Create feature list
    # --------------------------------------------------

    feature_columns = [
        column
        for column in df.columns
        if column not in columns_to_remove
    ]

    # --------------------------------------------------
    # 5. Create X and y
    # --------------------------------------------------

    X = df[feature_columns]

    y = df[TARGET_COLUMN]

    # --------------------------------------------------
    # 6. Display information
    # --------------------------------------------------

    print(
        f"Total samples: {len(df)}"
    )

    print(
        f"Number of input features: {X.shape[1]}"
    )

    print(
        f"Target column: {TARGET_COLUMN}"
    )

    print("\nInput features:")

    for column in X.columns:

        print(f" - {column}")

    print("\nTarget:")

    print(
        f" - {TARGET_COLUMN}"
    )

    print("========================================")
    print(
        "ML DATASET PREPARATION COMPLETED"
    )
    print("========================================")

    return X, y


if __name__ == "__main__":

    processed_file = (
        "data/processed/processed_ml_data.csv"
    )

    X, y = prepare_ml_dataset(
        processed_file
    )

    if X is not None and y is not None:

        print("\nX shape:")
        print(X.shape)

        print("\ny shape:")
        print(y.shape)