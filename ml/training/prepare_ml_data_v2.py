import pandas as pd


# --------------------------------------------------
# 1. Load dataset
# --------------------------------------------------

df = pd.read_csv("simulated_call_centre.csv")


# --------------------------------------------------
# 2. Convert date/time columns
# --------------------------------------------------

df["call_started"] = pd.to_datetime(
    df["date"] + " " + df["call_started"]
)

df["call_answered"] = pd.to_datetime(
    df["date"] + " " + df["call_answered"]
)

df["call_ended"] = pd.to_datetime(
    df["date"] + " " + df["call_ended"]
)


# --------------------------------------------------
# 3. Sort chronologically
# --------------------------------------------------

df = df.sort_values("call_started").reset_index(drop=True)


# --------------------------------------------------
# 4. Basic time features
# --------------------------------------------------

df["hour"] = df["call_started"].dt.hour

df["minute"] = df["call_started"].dt.minute

df["day_of_week"] = df["call_started"].dt.dayofweek


# --------------------------------------------------
# 5. Time since previous arrival
# --------------------------------------------------

df["time_since_previous_call"] = (
    df["call_started"]
    .diff()
    .dt.total_seconds()
)

df["time_since_previous_call"] = (
    df["time_since_previous_call"]
    .fillna(0)
)


# --------------------------------------------------
# 6. Calculate queue ahead
# --------------------------------------------------

queue_ahead = []

for current_time in df["call_started"]:

    waiting = (
        (df["call_started"] < current_time)
        & (df["call_answered"] > current_time)
    ).sum()

    queue_ahead.append(waiting)


df["queue_ahead"] = queue_ahead


# --------------------------------------------------
# 7. Recent arrivals
# --------------------------------------------------

# --------------------------------------------------
# 7. Recent arrivals
# --------------------------------------------------

arrival_times = df["call_started"]

recent_arrivals = []

for current_time in arrival_times:

    window_start = current_time - pd.Timedelta(minutes=10)

    count = (
        (arrival_times >= window_start)
        & (arrival_times < current_time)
    ).sum()

    recent_arrivals.append(count)


df["recent_arrivals"] = recent_arrivals

# --------------------------------------------------
# 8. Recent services
# --------------------------------------------------

answer_times = df["call_answered"]

recent_services = []

for current_time in df["call_started"]:

    window_start = current_time - pd.Timedelta(minutes=10)

    count = (
        (answer_times >= window_start)
        & (answer_times < current_time)
    ).sum()

    recent_services.append(count)


df["recent_services"] = recent_services


# --------------------------------------------------
# 9. Recent average service time
# --------------------------------------------------

df["avg_service_time"] = (
    df["service_length"]
    .rolling(20, min_periods=1)
    .mean()
)


# --------------------------------------------------
# 10. Replace invalid values
# --------------------------------------------------

df = df.fillna(0)


# --------------------------------------------------
# 11. Select ML features
# --------------------------------------------------

features = [
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


# --------------------------------------------------
# 12. Target
# --------------------------------------------------

target = "wait_length"


# --------------------------------------------------
# 13. Create training dataset
# --------------------------------------------------

ml_data = df[features + [target]].copy()


# --------------------------------------------------
# 14. Save
# --------------------------------------------------

ml_data.to_csv(
    "ml_training_data_v2.csv",
    index=False
)


print("\n===== ML DATA V2 =====")

print("\nFeatures:")
for feature in features:
    print("-", feature)

print("\nDataset shape:")
print(ml_data.shape)

print("\nFirst 10 rows:")
print(ml_data.head(10))

print("\nMissing values:")
print(ml_data.isnull().sum())

print("\nSaved as:")
print("ml_training_data_v2.csv")