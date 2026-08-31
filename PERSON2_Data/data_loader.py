import pandas as pd


def load_dataset(file_path):
    """
    Load a CSV dataset and return it as a pandas DataFrame.
    """

    try:
        df = pd.read_csv(file_path)

        print("Dataset loaded successfully.")
        print(f"Rows: {df.shape[0]}")
        print(f"Columns: {df.shape[1]}")

        return df

    except FileNotFoundError:
        print(f"Error: Dataset not found at '{file_path}'")
        return None

    except Exception as e:
        print(f"Error while loading dataset: {e}")
        return None
    
#testing 
if __name__ == "__main__":
    df = load_dataset("data/raw/ml_training_data_v2.csv")

    if df is not None:
        print("\nReal dataset preview:")
        print(df.head())

        print("\nColumn names:")
        print(df.columns.tolist())