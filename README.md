| Input                      | Data type       | Unit             | Meaning                                       |
| -------------------------- | --------------- | ---------------- | --------------------------------------------- |
| `current_queue_length`     | `int` / `float` | callers          | Current number of people waiting              |
| `queue_ahead`              | `int` / `float` | callers          | People ahead of the target caller             |
| `daily_caller`             | `int`           | callers          | Daily caller count/position used by V3        |
| `hour`                     | `int`           | hour, 0–23       | Hour of the call                              |
| `minute`                   | `int`           | minute, 0–59     | Minute of the call                            |
| `day_of_week`              | `int`           | day index        | Day index used by the V3 dataset              |
| `recent_arrivals`          | `int` / `float` | callers          | Arrivals during the recent observation window |
| `recent_services`          | `int` / `float` | services/callers | Completed services during the recent window   |
| `avg_service_time`         | `int` / `float` | seconds          | Average service duration                      |
| `time_since_previous_call` | `int` / `float` | seconds          | Time since previous call                      |




| Output                           | Type    | Unit           | Meaning                                |
| -------------------------------- | ------- | -------------- | -------------------------------------- |
| `forecast_horizon_minutes`       | `int`   | minutes        | Forecast period                        |
| `predicted_queue_length`         | `float` | callers        | Estimated queue after forecast horizon |
| `predicted_arrival_rate_per_min` | `float` | callers/minute | Estimated arrival rate                 |
| `predicted_wait_minutes`         | `float` | minutes        | **V3 ML predicted waiting time**       |
| `predicted_congestion_level`     | `str`   | —              | `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL` |
| `prediction_confidence`          | `float` | percent        | V3 model-level confidence indicator    |




Person 4 should use:

person 3/
└── prediction_interface.py

Import:

from prediction_interface import predict_crowd

The trained model used internally is:

crowd_wait_model_v3.pkl




The V3 model itself expects these 9 features:

queue_ahead
daily_caller
hour
minute
day_of_week
recent_arrivals
recent_services
avg_service_time
time_since_previous_call




7. Required packages

The interface uses:

pandas
joblib
scikit-learn

The V3 model was trained using:

HistGradientBoostingRegressor

from:

sklearn.ensemble
