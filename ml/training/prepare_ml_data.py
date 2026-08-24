import pandas as pd
# load the dataset
df = pd.read_csv("simulated_call_centre.csv")

# Convert date/time columns

df["call_started"] = pd.to_datetime(
    df["date"] + " " + df["call_started"])

df["call_answered"] = pd.to_datetime(
    df["date"] + " " + df["call_answered"])


# Sort calls chronologically
df = df.sort_values("call_started").reset_index(drop=True)


# Extract time-based features
df["hour"] = df["call_started"].dt.hour
df["minute"] = df["call_started"].dt.minute
df["day_of_week"] = df["call_started"].dt.dayofweek


# Calculate the number of people already waiting
# when each new call arrives.
queue_ahead = []

for i, current_time in enumerate(df["call_started"]):

    waiting = (
        (df["call_started"] < current_time)
        & (df["call_answered"] > current_time)
    ).sum()

    queue_ahead.append(waiting)


df["queue_ahead"] = queue_ahead


# Select ML features
features = [
    "queue_ahead",
    "daily_caller",
    "hour",
    "minute",
    "day_of_week"
]


# Target
target = "wait_length"


# Create ML dataset
ml_data = df[features + [target]].copy()


# Save prepared dataset
ml_data.to_csv(
    "ml_training_data.csv",
    index=False
)


print("\n===== ML DATA PREPARATION =====")

print("\nFeatures:")
print(features)

print("\nTarget:")
print(target)

print("\nDataset shape:")
print(ml_data.shape)

print("\nFirst 10 rows:")
print(ml_data.head(10))

print("\nMissing values:")
print(ml_data.isnull().sum())

print("\nWaiting-time statistics:")
print(ml_data["wait_length"].describe())

print("\nPrepared dataset saved as:")
print("ml_training_data.csv")