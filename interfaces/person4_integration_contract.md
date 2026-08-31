# Person 4 Integration Contract (Generic Digital Queue Management System)

This document defines the formal data contract and interface specifications for Person 4 (Optimization & Fairness Engine) within the 6-person Crowd Management Architecture.

---

## Architecture Context

```
PERSON 1 (User + Token + Appointment)
        ↓
PERSON 2 (Queue + Check-in + Crowd Data)
        ↓
PERSON 3 (AI Predictions)
        ↓
PERSON 4 (Optimization + Fairness + Dynamic ETA)  <-- THIS MODULE
        ↓
PERSON 5 (FastAPI + Database + Integration)
        ↓
PERSON 6 (Frontend + Dashboard)
        ↓
main.py (Complete System Entrypoint)
```

---

## 1. Input from Person 2 (Real-time Queue State)

Person 2 delivers real-time operational queue observation records.

| Field Name | Type | Unit / Format | Description |
| :--- | :--- | :--- | :--- |
| `queue_ahead` | `int` | Count | Number of queue entries/calls ahead of current position. |
| `recent_arrivals` | `float` | Count (10-min window) | Total customer arrivals in preceding 10 minutes. |
| `recent_services` | `float` | Count (10-min window) | Total completed services in preceding 10 minutes. |
| `avg_service_time` | `float` | Seconds | Rolling mean service duration over current & preceding observations (max 20 rows). |
| `wait_length` | `float` | Seconds | Waiting duration before service. |

### Derived Operations (via `interfaces/person4_input_adapter.py`)
- `arrival_rate_per_min` = `recent_arrivals / 10.0`
- `service_rate_per_counter_per_min` = `recent_services / (10.0 * active_counters)`
- `average_wait_minutes` = `wait_length / 60.0`

---

## 2. Input from Person 3 (AI Predictions)

Person 3 provides AI model forecast predictions over a future horizon.

| Field Name | Type | Range / Format | Description |
| :--- | :--- | :--- | :--- |
| `forecast_horizon_minutes` | `int` | > 0 | Prediction lookahead window in minutes. |
| `predicted_queue_length` | `int` | >= 0 | Forecasted queue length count. |
| `predicted_arrival_rate_per_min` | `float` | >= 0.0 | Forecasted arrival rate per minute. |
| `predicted_wait_minutes` | `float` | >= 0.0 | Forecasted average wait time in minutes. |
| `predicted_congestion_level` | `Enum` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | Forecasted operational congestion level. |
| `prediction_confidence` | `float` | `0.0` to `1.0` | Model confidence score. |

---

## 3. Input from Operational & System Modules

Operational resources, priority categories, and completed service times passed to Person 4.

| Category / Field | Type | Description |
| :--- | :--- | :--- |
| `active_counters` | `int` | Active physical service counter count (fallback: `DEFAULT_ACTIVE_COUNTERS = 4`). |
| `spare_counters` | `int` | Inactive counters available for activation (`OPEN_COUNTER`). |
| `reallocatable_resources` | `int` | Resource units available for capacity boost (`REALLOCATE_RESOURCE`). |
| `time_critical_users` | `int` | Count of `TIME_CRITICAL` priority tokens. |
| `vulnerable_users` | `int` | Count of `VULNERABLE` priority tokens. |
| `completed_service_times` | `List[float]` | Recent actual completed token service durations in minutes. |
| `admin_service_time_minutes` | `float` | Administrative default service time limit per token (default: `8.0` min). |

---

## 4. Output from Person 4 (OptimizationOutput)

Person 4 returns a structured `OptimizationOutput` Pydantic object for Person 5 backend ingestion.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `recommended_action.type` | `ActionType` | Recommended intervention (`NO_ACTION`, `OPEN_COUNTER`, `REALLOCATE_RESOURCE`, `PRIORITY_ADJUSTMENT`). |
| `decision.status` | `DecisionStatus` | Recommendation status (`RECOMMEND` or `NO_ACTION`). |
| `decision.score` | `float` (0–1) | Normalized multi-objective optimization score. |
| `decision.confidence` | `float` (0–1) | Decision process confidence score. |
| `impact.predicted_wait_minutes` | `float` | Projected wait time after recommended intervention. |
| `impact.predicted_queue_length` | `int` | Projected queue length after recommended intervention. |
| `impact.predicted_utilization` | `float` (0–1) | Projected capacity utilization ratio. |
| `impact.congestion_level` | `CongestionLevel` | Projected congestion level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`). |
| `resources.counters_required` | `int` | Additional counters required to execute recommendation. |
| `resources.resources_required` | `int` | Additional resource units required. |
| `fairness.fairness_score` | `float` (0–1) | Rule-based fairness evaluation score. |
| `fairness.priority_users_protected` | `bool` | Protection status for priority users (`TIME_CRITICAL`, `VULNERABLE`). |
| `fairness.constraint_satisfied` | `bool` | Flag indicating whether fairness constraints are satisfied. |
| `reason` | `str` | Transparent, human-readable rationale explaining the escalation/recommendation. |
| `alternatives` | `List[AlternativeScenario]` | Evaluated alternative candidate scenarios with scores and impacts. |

---

## 5. Dynamic ETA Engine Interface

Provided by `optimizer/eta_optimizer.py`:

```python
calculate_dynamic_eta(
    people_ahead: int,
    admin_service_time_minutes: float = 8.0,
    recent_completed_service_times: Optional[List[float]] = None,
    window_size: int = 10,
    active_counters: int = 1
) -> DynamicETAResult
```

### Calculation Behavior:
1. `people_ahead <= 0` → Returns `estimated_wait_minutes = 0.0` with `method = "ZERO_PEOPLE"`.
2. No completed history → Uses `admin_service_time_minutes` with `method = "DEFAULT_ADMIN"`.
3. Completed history present → Uses recent `window_size` completed service times, applies 1.5 × IQR outlier filtering, computes effective service time, and calculates dynamic ETA:
   $$\text{estimated\_wait\_minutes} = \frac{\text{people\_ahead} \times \text{effective\_service\_time\_minutes}}{\max(1, \text{active\_counters})}$$
4. Completely deterministic and non-negative.
