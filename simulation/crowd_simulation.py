from datetime import datetime, timedelta
import random

from app.services.person3.prediction_interface import predict_crowd
from app.services.person4.models.input_models import (
    OptimizationInput,
    CurrentOperationalState,
    Prediction,
    ResourceState,
    PriorityInfo,
    CongestionLevel,
)
from app.services.person4.optimizer.optimizer import optimize


def run_simulation(num_users=50, facility_id="SIM-H001", seed=42):
    random.seed(seed)

    now = datetime.now()
    users = []

    # Generate synthetic users
    for i in range(num_users):
        user_type = random.choices(
            ["normal", "vulnerable", "time_critical"],
            weights=[75, 15, 10]
        )[0]

        users.append({
            "token_id": f"SIM-{i + 1:03d}",
            "user_type": user_type,
            "is_vulnerable": user_type == "vulnerable",
            "is_time_critical": user_type == "time_critical",
            "arrival_time": now + timedelta(seconds=random.randint(0, 300)),
            "service_time": random.randint(120, 300),
        })

    users.sort(key=lambda x: x["arrival_time"])

    active_counters = 5
    spare_counters = 3

    results = []

    # Process the synthetic crowd in waves
    for step in range(1, 11):

        processed = min(
            num_users,
            int(num_users * step / 10)
        )

        current_users = users[:processed]

        queue_length = len(current_users)

        vulnerable = sum(
            u["is_vulnerable"] for u in current_users
        )

        time_critical = sum(
            u["is_time_critical"] for u in current_users
        )

        recent_arrivals = max(
            1,
            min(queue_length, int(queue_length * 0.6))
        )

        recent_services = max(
            1,
            min(queue_length, active_counters)
        )

        service_times = [
            u["service_time"]
            for u in current_users
        ]

        avg_service_time = (
            sum(service_times) / len(service_times)
            if service_times else 180
        )

        # -------- REAL PERSON 3 ML --------

        prediction_raw = predict_crowd(
            current_queue_length=queue_length,
            queue_ahead=queue_length,
            daily_caller=processed,
            hour=now.hour,
            minute=now.minute,
            day_of_week=now.weekday(),
            recent_arrivals=recent_arrivals,
            recent_services=recent_services,
            avg_service_time=avg_service_time,
            time_since_previous_call=30,
        )

        prediction = Prediction(
            forecast_horizon_minutes=
                prediction_raw["forecast_horizon_minutes"],

            predicted_queue_length=
                int(prediction_raw["predicted_queue_length"]),

            predicted_arrival_rate_per_min=
                prediction_raw["predicted_arrival_rate_per_min"],

            predicted_wait_minutes=
                prediction_raw["predicted_wait_minutes"],

            predicted_congestion_level=
                CongestionLevel(
                    prediction_raw["predicted_congestion_level"]
                ),

            # Person 3 returns percentage.
            # Person 4 expects 0-1.
            prediction_confidence=
                prediction_raw["prediction_confidence"] / 100.0,
        )

        arrival_rate = (
            recent_arrivals / 10.0
        )

        service_rate = (
            recent_services / 10.0
        )

        utilization = min(
            1.0,
            arrival_rate /
            max(
                0.01,
                active_counters * service_rate
            )
        )

        current_state = CurrentOperationalState(
            active_counters=active_counters,
            queue_length=queue_length,
            arrival_rate_per_min=arrival_rate,
            service_rate_per_counter_per_min=service_rate,
            average_wait_minutes=
                prediction.predicted_wait_minutes,
            utilization=utilization,
            completed_service_times=[
                x / 60.0 for x in service_times[-10:]
            ],
        )

        optimization_input = OptimizationInput(
            facility_id=facility_id,
            institution_type="Hospital",
            timestamp=now,
            current_state=current_state,
            prediction=prediction,
            resources=ResourceState(
                spare_counters=spare_counters,
                reallocatable_resources=2,
            ),
            priority=PriorityInfo(
                time_critical_users=time_critical,
                vulnerable_users=vulnerable,
            ),
        )

        # -------- REAL PERSON 4 OPTIMIZER --------

        optimization = optimize(optimization_input)

        # Apply recommended counter action for next simulation step
        if optimization.recommended_action.type.value == "OPEN_COUNTER":
            if active_counters < 5 + spare_counters:
                active_counters += 1
                spare_counters = max(0, spare_counters - 1)

        elif optimization.recommended_action.type.value == "REALLOCATE_RESOURCE":
            pass

        results.append({
            "step": step,
            "users_processed": processed,
            "total_users": num_users,
            "queue_length": queue_length,

            "prediction": prediction.model_dump(),

            "optimization": optimization.model_dump(
                mode="json"
            ),

            "active_counters": active_counters,
            "vulnerable_users": vulnerable,
            "time_critical_users": time_critical,
        })

    return {
        "simulation": {
            "facility_id": facility_id,
            "total_users": num_users,
            "generated_users": users,
        },
        "steps": results,
    }


if __name__ == "__main__":
    data = run_simulation(50)

    print("\n========================================")
    print(" CROWD SIMULATION")
    print("========================================")
    print(f"Users generated : {data['simulation']['total_users']}")

    for step in data["steps"]:
        p = step["prediction"]
        o = step["optimization"]

        print("\n----------------------------------------")
        print(f"STEP {step['step']}")
        print(f"Users        : {step['users_processed']}/50")
        print(f"Queue        : {step['queue_length']}")
        print(f"ML Wait      : {p['predicted_wait_minutes']:.2f} min")
        print(f"ML Crowd     : {p['predicted_congestion_level']}")
        print(f"ML Confidence: {p['prediction_confidence']:.2f}")

        print(
            "Optimizer    :",
            o["recommended_action"]["type"]
        )

        print(
            "Fairness     :",
            o["fairness"]["fairness_score"]
        )

        print(
            "Priority OK  :",
            o["fairness"]["priority_users_protected"]
        )

        print(
            "Reason       :",
            o["reason"]
        )
