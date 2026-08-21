# Person 3 — ML Model Handoff

## Dataset Ready

Person 2 has completed and validated the preprocessing pipeline.

Dataset size:

- Total samples: 51,708
- Training samples: 41,366
- Testing samples: 10,342

---

## Target

The model must predict:

`wait_length`

---

## Model Input Features

The model must receive exactly these 9 features, in this order:

1. queue_ahead
2. daily_caller
3. hour
4. minute
5. day_of_week
6. recent_arrivals
7. recent_services
8. avg_service_time
9. time_since_previous_call

Do NOT change the order.

---

## Training Files

Use:

`data/processed/X_train.csv`

and:

`data/processed/y_train.csv`

Dimensions:

```text
X_train: 41,366 × 9
y_train: 41,366 × 1