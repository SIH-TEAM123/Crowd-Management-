"""SIH Crowd Management Testing & Demonstration Simulator.

This module simulates dynamic crowd arrival waves (e.g. 20, 50, 100 users/tokens)
and feeds changing operational queue conditions directly into the EXISTING
SIH P4 pipeline:
1. prediction_interface.py (Loaded V3 ML Model)
2. optimizer.optimizer.optimize (P4 Multi-Objective Decision Engine)
3. optimizer.fairness_engine.evaluate_fairness (Fairness & Equity Evaluation)

IMPORTANT:
- Synthetic user tokens and initial queue states are SIMULATED for demonstration.
- All ML predictions, optimization scores, fairness evaluations, and action decisions
  are GENUINELY produced by the existing codebase. No hard-coded scores or fake decisions.
"""

import argparse
import random
import sys
from datetime import datetime, timedelta
from typing import Any, Dict, List

# Imports from existing project modules
from models.input_models import (
    CongestionLevel,
    CurrentOperationalState,
    OptimizationInput,
    Prediction,
    PriorityInfo,
    ResourceState,
)
from models.output_models import OptimizationOutput
from optimizer.optimizer import optimize
from prediction_interface import predict_crowd


def generate_simulated_users(
    num_users: int, seed: int = 42
) -> List[Dict[str, Any]]:
    """Generate synthetic user/token records with realistic attributes.

    Includes a mixture of normal, vulnerable (elderly/disabled), and
    time-critical priority users.

    DATA STATUS: [SIMULATED INPUT DATA]
    """
    rng = random.Random(seed)
    users = []
    base_time = datetime.now()

    for i in range(1, num_users + 1):
        # Category distribution: ~75% normal, ~15% vulnerable, ~10% time-critical
        category_roll = rng.random()
        if category_roll < 0.75:
            user_type = "normal"
            is_vulnerable = False
            is_time_critical = False
        elif category_roll < 0.90:
            user_type = "vulnerable"
            is_vulnerable = True
            is_time_critical = False
        else:
            user_type = "time_critical"
            is_vulnerable = False
            is_time_critical = True

        arrival_offset_sec = rng.randint(0, min(1800, num_users * 30))
        est_service_sec = rng.randint(120, 300)

        users.append(
            {
                "token_id": f"TOK-SIM-{i:03d}",
                "user_type": user_type,
                "is_vulnerable": is_vulnerable,
                "is_time_critical": is_time_critical,
                "arrival_time": base_time + timedelta(seconds=arrival_offset_sec),
                "est_service_sec": est_service_sec,
            }
        )

    return users


def run_simulation(
    num_users: int = 20,
    seed: int = 42,
    batches: int = 4,
    verbose: bool = False,
) -> List[Dict[str, Any]]:
    """Execute dynamic multi-step crowd simulation through existing P4 modules.

    Progression flow per batch step:
    Simulated Users -> Queue State -> ML Prediction -> Optimization -> Fairness -> Output

    Returns list of step results.
    """
    users = generate_simulated_users(num_users, seed=seed)
    rng = random.Random(seed)

    print("=" * 80)
    print("  SIH P4 CROWD MANAGEMENT SIMULATOR (DEMONSTRATION & TESTING UTILITY)")
    print("=" * 80)
    print(f"  Configuration: [SIMULATED] Users: {num_users} | Seed: {seed} | Batches: {batches}")
    print(f"  Existing ML Model: crowd_wait_model_v3.pkl")
    print(f"  Existing Decision Engine: optimizer.optimizer.optimize")
    print("=" * 80 + "\n")

    # Divide users into batch arrival waves
    batch_size = max(1, num_users // batches)
    step_results = []

    # Initial operational baselines
    active_counters = 4
    spare_counters = 2
    reallocatable_resources = 1

    current_queue_length = 0
    total_processed = 0

    for step in range(1, batches + 1):
        print(f"--- BATCH STEP {step} of {batches} ---")

        # Determine users arriving in this batch
        start_idx = (step - 1) * batch_size
        if step == batches:
            batch_users = users[start_idx:]
        else:
            batch_users = users[start_idx : start_idx + batch_size]

        new_arrivals = len(batch_users)

        # Count priority users in current batch arrival
        batch_vulnerable = sum(1 for u in batch_users if u["is_vulnerable"])
        batch_time_critical = sum(1 for u in batch_users if u["is_time_critical"])

        # Update queue length based on arrivals and services
        serviced_in_step = min(
            current_queue_length + new_arrivals,
            rng.randint(2, max(3, active_counters * 2)),
        )

        current_queue_length = max(
            0, current_queue_length + new_arrivals - serviced_in_step
        )
        total_processed += serviced_in_step

        # Active queue priority counts
        vulnerable_in_queue = sum(
            1 for u in batch_users if u["is_vulnerable"]
        ) + (1 if current_queue_length > 5 and rng.random() > 0.5 else 0)
        time_critical_in_queue = sum(
            1 for u in batch_users if u["is_time_critical"]
        )

        # Simulated operational parameters for Person 3 / ML model input
        recent_arrivals = new_arrivals + rng.randint(1, 4)
        recent_services = max(1, serviced_in_step + rng.randint(0, 2))
        queue_ahead = max(0, current_queue_length - 1)
        daily_caller = total_processed + current_queue_length + 10
        avg_service_time_sec = float(rng.randint(180, 240))
        time_since_prev_call_sec = float(rng.randint(5, 20))
        hour = (10 + (step * 15) // 60) % 24
        minute = (step * 15) % 60
        day_of_week = 1

        print(f"  [SIMULATED QUEUE STATE]")
        print(f"    Total Simulated Users Processed/Arriving: {start_idx + len(batch_users)} / {num_users}")
        print(f"    Current Queue Length : {current_queue_length} callers")
        print(f"    Recent Arrivals (10m): {recent_arrivals} callers")
        print(f"    Recent Services (10m): {recent_services} services")
        print(f"    Active Counters      : {active_counters} | Spare Counters: {spare_counters}")
        print(f"    Priority Queue       : {time_critical_in_queue} Time-Critical, {vulnerable_in_queue} Vulnerable")

        # -------------------------------------------------------------------
        # 1. INVOKE EXISTING ML PREDICTION INTERFACE (prediction_interface.py)
        # -------------------------------------------------------------------
        try:
            raw_pred = predict_crowd(
                current_queue_length=current_queue_length,
                queue_ahead=queue_ahead,
                daily_caller=daily_caller,
                hour=hour,
                minute=minute,
                day_of_week=day_of_week,
                recent_arrivals=recent_arrivals,
                recent_services=recent_services,
                avg_service_time=avg_service_time_sec,
                time_since_previous_call=time_since_prev_call_sec,
                recent_window_minutes=10,
            )

            # Normalize prediction confidence to [0.0, 1.0] for Pydantic schema
            raw_conf = float(raw_pred["prediction_confidence"])
            normalized_conf = (
                min(1.0, max(0.0, raw_conf / 100.0))
                if raw_conf > 1.0
                else max(0.0, raw_conf)
            )

            print(f"\n  [GENUINE ML PREDICTION (crowd_wait_model_v3.pkl)]")
            print(f"    Predicted Wait Time  : {raw_pred['predicted_wait_minutes']:.2f} minutes")
            print(f"    Predicted Queue      : {raw_pred['predicted_queue_length']:.1f} callers")
            print(f"    Predicted Congestion : {raw_pred['predicted_congestion_level']}")
            print(f"    Model R² Confidence  : {raw_pred['prediction_confidence']}%")

        except Exception as e:
            print(f"  [ERROR] ML Prediction step failed: {e}", file=sys.stderr)
            continue

        # -------------------------------------------------------------------
        # 2. CONSTRUCT Pydantic OptimizationInput FOR PERSON 4 OPTIMIZER
        # -------------------------------------------------------------------
        try:
            arrival_rate = recent_arrivals / 10.0
            service_rate = (
                recent_services / (10.0 * active_counters)
                if active_counters > 0
                else 0.0
            )

            capacity = service_rate * active_counters
            utilization = (
                min(1.0, max(0.0, arrival_rate / capacity))
                if capacity > 0
                else 0.0
            )

            completed_service_times = [
                avg_service_time_sec / 60.0 for _ in range(recent_services)
            ]

            opt_input = OptimizationInput(
                facility_id="FACILITY_SIM_DEMO",
                institution_type="hospital",
                timestamp=datetime.now(),
                current_state=CurrentOperationalState(
                    active_counters=active_counters,
                    queue_length=current_queue_length,
                    arrival_rate_per_min=arrival_rate,
                    service_rate_per_counter_per_min=service_rate,
                    average_wait_minutes=float(raw_pred["predicted_wait_minutes"]),
                    utilization=utilization,
                    completed_service_times=completed_service_times,
                ),
                prediction=Prediction(
                    forecast_horizon_minutes=int(raw_pred["forecast_horizon_minutes"]),
                    predicted_queue_length=int(round(raw_pred["predicted_queue_length"])),
                    predicted_arrival_rate_per_min=float(raw_pred["predicted_arrival_rate_per_min"]),
                    predicted_wait_minutes=float(raw_pred["predicted_wait_minutes"]),
                    predicted_congestion_level=CongestionLevel(raw_pred["predicted_congestion_level"]),
                    prediction_confidence=normalized_conf,
                ),
                resources=ResourceState(
                    spare_counters=spare_counters,
                    reallocatable_resources=reallocatable_resources,
                ),
                priority=PriorityInfo(
                    time_critical_users=time_critical_in_queue,
                    vulnerable_users=vulnerable_in_queue,
                ),
            )
        except Exception as e:
            print(f"  [ERROR] OptimizationInput construction failed: {e}", file=sys.stderr)
            continue

        # -------------------------------------------------------------------
        # 3. INVOKE EXISTING OPTIMIZER & DECISION ENGINE (optimizer/optimizer.py)
        # -------------------------------------------------------------------
        try:
            opt_output: OptimizationOutput = optimize(opt_input)

            print(f"\n  [GENUINE OPTIMIZER & DECISION ENGINE OUTPUT]")
            print(f"    Recommended Action   : {opt_output.recommended_action.type.value}")
            print(f"    Decision Score       : {opt_output.decision.score:.4f} (0.0 to 1.0)")
            print(f"    Decision Confidence  : {opt_output.decision.confidence:.2f}")
            print(f"    Fairness Score       : {opt_output.fairness.fairness_score:.2f}")
            print(f"    Priority Protected   : {opt_output.fairness.priority_users_protected}")
            print(f"    Fairness Satisfied   : {opt_output.fairness.constraint_satisfied}")
            print(f"    Impact Projected Wait: {opt_output.impact.predicted_wait_minutes:.2f} m")
            print(f"    Impact Queue Length  : {opt_output.impact.predicted_queue_length} callers")
            print(f"    Rationale            : {opt_output.reason}")

            if verbose:
                print(f"\n    [EVALUATED ALTERNATIVE SCENARIOS]")
                for alt in opt_output.alternatives:
                    print(
                        f"      - Action: {alt.action.value:20s} | Score: {alt.score:.4f} | "
                        f"Wait: {alt.predicted_wait_minutes:.1f}m | Feasible: {alt.feasible}"
                    )

            step_results.append(
                {
                    "step": step,
                    "simulated_users": len(batch_users),
                    "queue_length": current_queue_length,
                    "ml_wait_min": raw_pred["predicted_wait_minutes"],
                    "congestion": raw_pred["predicted_congestion_level"],
                    "action": opt_output.recommended_action.type.value,
                    "score": opt_output.decision.score,
                    "fairness_score": opt_output.fairness.fairness_score,
                }
            )

        except Exception as e:
            print(f"  [ERROR] Optimization execution failed: {e}", file=sys.stderr)
            continue

        print("\n" + "-" * 80 + "\n")

    # -------------------------------------------------------------------
    # SIMULATION SUMMARY REPORT
    # -------------------------------------------------------------------
    print("=" * 80)
    print("  SIMULATION DEMONSTRATION SUMMARY")
    print("=" * 80)
    print(f"  Total Simulated Users Configured : {num_users}")
    print(f"  Total Simulation Steps Executed : {len(step_results)}")
    print("-" * 80)
    print(f"  {'Step':<6} | {'Queue':<6} | {'ML Wait (m)':<12} | {'Congestion':<10} | {'Action Recommended':<22} | {'Score':<6}")
    print("-" * 80)
    for r in step_results:
        print(
            f"  Step {r['step']:<2} | {r['queue_length']:<6} | {r['ml_wait_min']:<12.2f} | "
            f"{r['congestion']:<10} | {r['action']:<22} | {r['score']:<6.4f}"
        )
    print("=" * 80)
    print("  [DEMONSTRATION COMPLETE - ALL ML & OPTIMIZER RESULTS ARE REAL]")
    print("=" * 80 + "\n")

    return step_results


def main():
    parser = argparse.ArgumentParser(
        description="SIH P4 Crowd Management Demonstration & Testing Simulator"
    )
    parser.add_argument(
        "--users",
        type=int,
        default=20,
        help="Number of simulated users (e.g. 20, 50, 100)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for deterministic user stream generation (default: 42)",
    )
    parser.add_argument(
        "--batches",
        type=int,
        default=4,
        help="Number of simulation batch progression steps (default: 4)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Display detailed alternative scenario evaluations",
    )

    args = parser.parse_args()
    run_simulation(
        num_users=args.users,
        seed=args.seed,
        batches=args.batches,
        verbose=args.verbose,
    )


if __name__ == "__main__":
    main()
