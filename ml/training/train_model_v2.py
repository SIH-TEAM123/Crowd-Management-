import pandas as pd
import joblib

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# --------------------------------------------------
# 1. Load Version 2 dataset
# --------------------------------------------------

df = pd.read_csv("ml_training_data_v2.csv")


# --------------------------------------------------
# 2. Define features
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


target = "wait_length"


X = df[features]
y = df[target]


# --------------------------------------------------
# 3. Chronological train/test split
# --------------------------------------------------

split_index = int(len(df) * 0.80)

X_train = X.iloc[:split_index]
X_test = X.iloc[split_index:]

y_train = y.iloc[:split_index]
y_test = y.iloc[split_index:]


# --------------------------------------------------
# 4. Create Random Forest model
# --------------------------------------------------

model = RandomForestRegressor(
    n_estimators=150,
    max_depth=15,
    random_state=42,
    n_jobs=-1
)


# --------------------------------------------------
# 5. Train
# --------------------------------------------------

print("\nTraining Random Forest V2...")

model.fit(X_train, y_train)


# --------------------------------------------------
# 6. Predict
# --------------------------------------------------

predictions = model.predict(X_test)


# --------------------------------------------------
# 7. Evaluate
# --------------------------------------------------

mae = mean_absolute_error(y_test, predictions)

rmse = mean_squared_error(
    y_test,
    predictions
) ** 0.5

r2 = r2_score(y_test, predictions)


print("\n===== MODEL V2 PERFORMANCE =====")

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

importance = pd.DataFrame({
    "feature": features,
    "importance": model.feature_importances_
})

importance = importance.sort_values(
    "importance",
    ascending=False
)


print("\n===== FEATURE IMPORTANCE =====")

print(importance)


# --------------------------------------------------
# 10. Save V2 model
# --------------------------------------------------

joblib.dump(
    model,
    "crowd_wait_model_v2.pkl"
)


print("\nModel saved as:")
print("crowd_wait_model_v2.pkl")