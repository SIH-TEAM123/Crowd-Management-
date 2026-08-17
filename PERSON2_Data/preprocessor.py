import os

from data_loader import load_dataset
from cleaner import clean_dataset
from feature_engineering import create_features


def preprocess_dataset(input_path, output_path):
    """
    Complete preprocessing pipeline for the real dataset.

    Steps:
    1. Load raw dataset
    2. Clean dataset
    3. Create engineered features
    4. Save processed dataset
    """

    print("========================================")
    print("STARTING PREPROCESSING PIPELINE")
    print("========================================")

    # --------------------------------------------------
    # 1. Load raw dataset
    # --------------------------------------------------

    df = load_dataset(input_path)

    if df is None:
        print("Preprocessing stopped: dataset could not be loaded.")
        return None

    # --------------------------------------------------
    # 2. Clean dataset
    # --------------------------------------------------

    cleaned_df = clean_dataset(df)

    if cleaned_df is None:
        print("Preprocessing stopped: cleaning failed.")
        return None

    # --------------------------------------------------
    # 3. Feature engineering
    # --------------------------------------------------

    feature_df = create_features(cleaned_df)

    if feature_df is None:
        print("Preprocessing stopped: feature engineering failed.")
        return None

    # --------------------------------------------------
    # 4. Create output directory
    # --------------------------------------------------

    output_directory = os.path.dirname(output_path)

    if output_directory:
        os.makedirs(
            output_directory,
            exist_ok=True
        )

    # --------------------------------------------------
    # 5. Save processed dataset
    # --------------------------------------------------

    feature_df.to_csv(
        output_path,
        index=False
    )

    # --------------------------------------------------
    # 6. Final summary
    # --------------------------------------------------

    print("========================================")
    print("PREPROCESSING COMPLETED")
    print("========================================")

    print(
        f"Processed dataset saved to:\n"
        f"{output_path}"
    )

    print(
        f"Final rows: {feature_df.shape[0]}"
    )

    print(
        f"Final columns: {feature_df.shape[1]}"
    )

    return feature_df


if __name__ == "__main__":

    input_file = (
        "data/raw/ml_training_data_v2.csv"
    )

    output_file = (
        "data/processed/processed_ml_data.csv"
    )

    preprocess_dataset(
        input_file,
        output_file
    )