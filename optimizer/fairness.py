"""Fairness calculation and constraint module.

Enforces fairness constraints, evaluates priority policies,
calculates Jain's fairness index, prevents standard queue starvation,
integrates P5 PriorityType compatibility, and re-exports core fairness engine functionality.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union
from models.input_models import OptimizationInput
from models.output_models import ActionType
from optimizer.fairness_engine import (
    FairnessEvaluationResult,
    FairnessEvaluationStatus,
    evaluate_fairness,
)


class P5PriorityType(str, Enum):
    """P5-compatible priority types."""
    NORMAL = "NORMAL"
    VULNERABLE = "VULNERABLE"
    TIME_CRITICAL = "TIME_CRITICAL"


# Base priority weights matching P5 priority tiers
P5_PRIORITY_BASE_WEIGHTS: Dict[str, float] = {
    P5PriorityType.NORMAL.value: 1.0,
    P5PriorityType.VULNERABLE.value: 2.0,
    P5PriorityType.TIME_CRITICAL.value: 4.0,
}


def calculate_priority_score_with_wait(
    priority_type: Union[P5PriorityType, str],
    wait_minutes: float,
) -> float:
    """Calculate effective priority score considering both P5 PriorityType and waiting time.

    Ensures that long-waiting NORMAL users eventually accumulate sufficient priority weight
    to prevent permanent queue starvation from VULNERABLE or TIME_CRITICAL users.

    Formula: Effective Priority = Base Weight + (wait_minutes * 0.1)

    Args:
        priority_type: P5 PriorityType enum or string ("NORMAL", "VULNERABLE", "TIME_CRITICAL").
        wait_minutes: Time spent waiting in queue in minutes.

    Returns:
        float: Effective priority score.
    """
    if hasattr(priority_type, "value"):
        pt_str = str(priority_type.value).upper()
    else:
        pt_str = str(priority_type).upper()

    base_weight = P5_PRIORITY_BASE_WEIGHTS.get(pt_str, 1.0)
    wait_bonus = max(0.0, float(wait_minutes)) * 0.1
    return round(base_weight + wait_bonus, 2)


def calculate_jain_fairness_index(values: List[float]) -> float:
    """Calculate Jain's Fairness Index for a set of wait times or service rates.

    Formula: J = (sum(x_i))^2 / (n * sum(x_i^2))
    Result is bounded between 1/n (worst case) and 1.0 (perfect fairness).

    Args:
        values: List of non-negative float values (e.g. wait times per user class).

    Returns:
        float: Fairness index between 0.0 and 1.0.
    """
    if not values:
        return 1.0

    valid_vals = [max(0.0, float(v)) for v in values]
    n = len(valid_vals)
    if n == 0:
        return 1.0

    sum_vals = sum(valid_vals)
    if sum_vals == 0.0:
        return 1.0

    sum_sq = sum(v ** 2 for v in valid_vals)
    if sum_sq == 0.0:
        return 1.0

    fairness_index = (sum_vals ** 2) / (n * sum_sq)
    return round(min(1.0, max(0.0, fairness_index)), 4)


def evaluate_starvation_risk(
    average_wait_minutes: float,
    priority_users_count: int,
    total_queue_length: int,
) -> Dict[str, Any]:
    """Evaluate whether normal/standard queue users are experiencing queue starvation.

    High average wait time (> 15 mins) combined with high priority user presence
    increases normal user starvation risk.

    Args:
        average_wait_minutes: Average wait time in minutes.
        priority_users_count: Number of priority/vulnerable/time-critical users.
        total_queue_length: Total queue length.

    Returns:
        Dict[str, Any] containing starvation risk level, starvation score, and recommendation.
    """
    avg_wait = max(0.0, float(average_wait_minutes))
    p_count = max(0, int(priority_users_count))
    q_len = max(0, int(total_queue_length))

    priority_ratio = (p_count / q_len) if q_len > 0 else 0.0

    # Starvation score calculation (0.0 = low risk, 1.0 = extreme starvation risk)
    wait_factor = min(1.0, avg_wait / 30.0)
    ratio_factor = min(1.0, priority_ratio * 2.0)
    starvation_score = round(0.6 * wait_factor + 0.4 * ratio_factor, 3)

    if avg_wait > 20.0 or starvation_score > 0.65:
        risk_level = "HIGH"
        requires_capacity = True
        reason = "Normal queue wait time is critical; capacity expansion required to prevent queue starvation."
    elif avg_wait > 10.0 or starvation_score > 0.35:
        risk_level = "MEDIUM"
        requires_capacity = False
        reason = "Moderate wait time observed; monitor priority ratio to prevent normal user starvation."
    else:
        risk_level = "LOW"
        requires_capacity = False
        reason = "Normal queue operating within acceptable wait time limits."

    return {
        "starvation_risk": risk_level,
        "starvation_score": starvation_score,
        "priority_ratio": round(priority_ratio, 3),
        "requires_capacity_expansion": requires_capacity,
        "reason": reason,
    }


def evaluate_p5_priority_compatibility(priority_counts: Dict[str, int]) -> Dict[str, Any]:
    """Evaluate priority breakdown compatibility with P5 token PriorityTypes.

    Args:
        priority_counts: Dict mapping P5 PriorityType strings to counts.
                         e.g. {"NORMAL": 10, "VULNERABLE": 3, "TIME_CRITICAL": 1}

    Returns:
        Dict containing mapped counts, total priority count, and compatibility status.
    """
    normal = priority_counts.get("NORMAL", 0)
    vulnerable = priority_counts.get("VULNERABLE", 0)
    time_critical = priority_counts.get("TIME_CRITICAL", 0)

    total_priority = vulnerable + time_critical

    return {
        "p5_compatible": True,
        "counts": {
            "NORMAL": normal,
            "VULNERABLE": vulnerable,
            "TIME_CRITICAL": time_critical,
        },
        "total_priority_users": total_priority,
        "has_priority_users": total_priority > 0,
    }


__all__ = [
    "P5PriorityType",
    "FairnessEvaluationResult",
    "FairnessEvaluationStatus",
    "evaluate_fairness",
    "calculate_jain_fairness_index",
    "evaluate_starvation_risk",
    "calculate_priority_score_with_wait",
    "evaluate_p5_priority_compatibility",
]
