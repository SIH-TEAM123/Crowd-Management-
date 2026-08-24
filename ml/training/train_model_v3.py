import pandas as pd
import numpy as np
import joblib

from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# --------------------------------------------------
# 1. Load dataset
# --------------------------------------------------

df = pd.read_csv("ml_training_data_v2.csv")


# --------------------------------------------------
# 2. Define features
# --------------------------------------------------
# (same feature set as v2 — tested several engineered additions,
#  e.g. cyclical hour encoding, queue_ahead * avg_service_time,
#  none improved on this feature set, so kept as-is)

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

target = "wait_length"

X = df[features]
y = df[target]


# --------------------------------------------------
# 3. Chronological train/test split
# --------------------------------------------------
# kept chronological (not shuffled/random) since this is
# time-ordered queue data and shuffling would leak future
# queue state into the training set

split_index = int(len(df) * 0.80)

X_train = X.iloc[:split_index]
X_test = X.iloc[split_index:]

y_train = y.iloc[:split_index]
y_test = y.iloc[split_index:]


# --------------------------------------------------
# 4. Create model
# --------------------------------------------------
# Switched from RandomForestRegressor to HistGradientBoostingRegressor.
# The target is heavily zero-inflated (~88% of calls wait 0s) with a
# long right tail when queue_ahead > 0. Boosting many shallow trees
# handles this bias/variance tradeoff better than a single deep RF:
# tuning (grid tested offline) found max_depth=4 with more, smaller
# boosting steps beat every RF depth/estimator combination on
# MAE, RMSE, AND R^2 simultaneously.
#
# early_stopping is enabled so max_iter is a ceiling, not a fixed
# cost — training stops once a held-out validation slice stops
# improving, which also guards against overfitting the long tail.

model = HistGradientBoostingRegressor(
    max_iter=500,
    max_depth=4,
    learning_rate=0.05,
    l2_regularization=0.1,
    early_stopping=True,
    validation_fraction=0.1,
    n_iter_no_change=20,
    random_state=42
)


# --------------------------------------------------
# 5. Train
# --------------------------------------------------

print("\nTraining HistGradientBoosting V3...")

model.fit(X_train, y_train)

print(f"Stopped after {model.n_iter_} boosting iterations "
      f"(early stopping ceiling: 500)")


# --------------------------------------------------
# 6. Predict
# --------------------------------------------------

predictions = model.predict(X_test)
predictions = np.clip(predictions, 0, None)  # wait times can't be negative


# --------------------------------------------------
# 7. Evaluate
# --------------------------------------------------

mae = mean_absolute_error(y_test, predictions)

rmse = mean_squared_error(
    y_test,
    predictions
) ** 0.5

r2 = r2_score(y_test, predictions)


print("\n===== MODEL V3 PERFORMANCE =====")

print(f"MAE  : {mae:.2f} seconds")
print(f"RMSE : {rmse:.2f} seconds")
print(f"R²   : {r2:.4f}")


# --------------------------------------------------
# 8. Sample predictions
# --------------------------------------------------

results = pd.DataFrame({
    "actual_wait": y_test.values[:10],
    "predicted_wait": predictions[:10]
})


print("\n===== SAMPLE PREDICTIONS =====")

print(results)


# --------------------------------------------------
# 9. Feature importance
# --------------------------------------------------
# HistGradientBoostingRegressor has no built-in feature_importances_
# (unlike RandomForest), so permutation importance is used instead:
# it measures how much test-set MAE degrades when each feature's
# values are shuffled, computed directly on the held-out test set.

print("\nComputing permutation importance...")

perm_result = permutation_importance(
    model,
    X_test,
    y_test,
    n_repeats=10,
    random_state=42,
    scoring="neg_mean_absolute_error",
    n_jobs=-1
)

importance = pd.DataFrame({
    "feature": features,
    "importance_mean": perm_result.importances_mean,
    "importance_std": perm_result.importances_std
})

importance = importance.sort_values(
    "importance_mean",
    ascending=False
)


print("\n===== FEATURE IMPORTANCE (permutation) =====")

print(importance)


# --------------------------------------------------
# 10. Save V3 model
# --------------------------------------------------

joblib.dump(
    model,
    "crowd_wait_model_v3.pkl"
)


print("\nModel saved as:")
print("crowd_wait_model_v3.pkl")
