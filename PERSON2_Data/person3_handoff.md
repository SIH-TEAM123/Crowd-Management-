# Person 2 → Person 3 Handoff

## 1. Purpose

Person 2 prepares and validates the queue/call-centre dataset for the machine learning stage.

The preprocessing pipeline performs:

1. Data loading
2. Data cleaning
3. Feature engineering
4. Dataset validation
5. ML feature selection
6. Train/test splitting

---

# 2. Raw Dataset

The real dataset is:

`data/raw/ml_training_data_v2.csv`

Dataset size:

- 51,708 rows
- 10 original columns

---

# 3. Original Dataset Features

The raw dataset contains:

- queue_ahead
- daily_caller
- hour
- minute
- day_of_week
- recent_arrivals
- recent_services
- avg_service_time
- time_since_previous_call
- wait_length

---

# 4. Target Variable

The machine learning target is:

`wait_length`

The model should predict the expected waiting time.

---

# 5. Feature Engineering

Person 2 creates the following additional features:

- hour_sin
- hour_cos
- minute_sin
- minute_cos
- day_sin
- day_cos
- arrival_service_ratio
- queue_per_service
- estimated_service_load
- arrival_minus_service
- queue_arrival_ratio

The final processed dataset therefore contains:

**21 columns**

This complete dataset is preserved for use by other project modules, analytics, dashboards, metrics, and future ML experiments.

---

# 6. Person 3 Model Input

Person 3 requires exactly these 9 input features:

1. queue_ahead
2. daily_caller
3. hour
4. minute
5. day_of_week
6. recent_arrivals
7. recent_services
8. avg_service_time
9. time_since_previous_call

The target is:

`wait_length`

Therefore the Person 3 model receives:

**9 input features → wait_length**

---

# 7. Important Data Architecture

The full processed dataset is:

`data/processed/processed_ml_data.csv`

It contains:

**51,708 rows × 21 columns**

The 11 engineered features are NOT deleted.

They remain available for other project modules.

The Person 3 model dataset is created separately by `dataset_splitter.py`.

Therefore:

```text
processed_ml_data.csv
        │
        ├── Full 21-column dataset
        │       │
        │       ├── Analytics
        │       ├── Metrics
        │       ├── Optimization
        │       └── Other modules
        │
        └── Person 3 model selection
                │
                ├── 9 input features
                └── wait_length target