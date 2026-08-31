import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error , mean_squared_error , r2_score

# now we load the prepared ml dataset

df = pd.read_csv("ml_training_data.csv")

#Defining the features and target

features = [
    "queue_ahead",
    "daily_caller",
    "hour",
    "minute",
    "day_of_week"
]

target = "wait_length"

X = df[features]
y = df[target]

# now we chronologically trai test split

split_index = int(len(df)* 0.80)

X_train = X.iloc[:split_index]
X_test = X.iloc[split_index:]

y_train = y.iloc[:split_index]
y_test = y.iloc[split_index:]

#now we Create Random Forest model
'''why we use random forest because our data is structured
with no images and text , so random forest can learn non familiar relationships
such as large queue , high arrival period , peak hour , long waiting time
We also use a chronologically 80/20 split.  '''

model = RandomForestRegressor(
    n_estimators=150,
    max_depth=15,
    random_state=42,
    n_jobs=-1
)

# and now we train the model

print("\n Training the random forest model starts")
model.fit(X_train,y_train)

# predict the test data

predictions = model.predict(X_test)

# evaluation

mae = mean_absolute_error(y_test , predictions)

rmse = mean_squared_error(
    y_test,
    predictions
)**0.5
r2 = r2_score(y_test, predictions)
#R² (R-squared) tells us how well our ML model explains the variation in the actual waiting times.

print("\n===== MODEL PERFORMANCE =====")

print(f"MAE  : {mae:.2f} seconds")
print(f"RMSE : {rmse:.2f} seconds")
print(f"R²   : {r2:.4f}")

''': - start formatting rules
    .2 - show 2 digits after the decimal point.
    f - format the number as floating-point number'''

#  Show sample predictions

results = pd.DataFrame({
    "actual_wait": y_test.values[:10],
    "predicted_wait": predictions[:10]
})

print("\n.....PREDICTIONS....")
print(results)

# Save trained model

joblib.dump(
    model,
    "crowd_wait_model.pkl"
)

print("\nModel saved as:")
print("crowd_wait_model.pkl")

'''On average, the model's predicted waiting time is about 28 seconds away from the actual value.

That's reasonably understandable for a first model.

RMSE = 57.07 seconds

There are some larger prediction errors. RMSE being considerably higher than MAE tells us the model occasionally makes bigger mistakes.

R² = 0.5605

The model explains about 56% of the variation in waiting time on this test set.

So I'd describe this as a moderate first model, not an excellent one.'''