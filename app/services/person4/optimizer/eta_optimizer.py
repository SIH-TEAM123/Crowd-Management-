"""Dynamic waiting-time estimation module for Person 4 optimization engine.

Calculates dynamic ETA based on people ahead, administrative default service time limit,
and recent actual completed token service durations.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class DynamicETAResult(BaseModel):
    """Result payload for dynamic ETA calculation."""
    estimated_wait_minutes: float = Field(..., ge=0.0, description="Estimated wait time in minutes")
    effective_service_time_minutes: float = Field(..., ge=0.0, description="Effective service time per token in minutes")
    calculation_method: str = Field(..., description="Method used for estimation (ZERO_PEOPLE, DEFAULT_ADMIN, HISTORICAL_SMOOTHED)")
    people_ahead: int = Field(..., ge=0, description="Number of tokens/people ahead in queue")
    active_counters: int = Field(..., ge=0, description="Active service counters count")


def _calculate_robust_mean(values: List[float]) -> float:
    """Calculates an outlier-resistant mean from a list of positive float values.

    For small samples (< 4), returns the simple mean.
    For larger samples (>= 4), uses 1.5 * IQR filtering to exclude extreme outliers.
    """
    if not values:
        return 0.0

    n = len(values)
    if n < 4:
        return sum(values) / n

    sorted_v = sorted(values)
    # Simple percentile estimation
    q1_idx = int(0.25 * (n - 1))
    q3_idx = int(0.75 * (n - 1))
    q1 = sorted_v[q1_idx]
    q3 = sorted_v[q3_idx]
    iqr = q3 - q1

    # Avoid zero IQR filtering out valid mild variations
    min_iqr = max(iqr, 0.2 * q1 if q1 > 0 else 1.0)

    lower_bound = max(0.0, q1 - 1.5 * min_iqr)
    upper_bound = q3 + 1.5 * min_iqr

    filtered = [x for x in values if lower_bound <= x <= upper_bound]
    if not filtered:
        filtered = sorted_v

    return sum(filtered) / len(filtered)


def calculate_dynamic_eta(
    people_ahead: int,
    admin_service_time_minutes: float = 8.0,
    recent_completed_service_times: Optional[List[float]] = None,
    window_size: int = 10,
    active_counters: int = 1,
) -> DynamicETAResult:
    """Calculates dynamic estimated waiting time (ETA) for a queue position.

    Args:
        people_ahead: Number of people/tokens ahead in queue.
        admin_service_time_minutes: Default administrative service time limit in minutes.
        recent_completed_service_times: List of actual completed token service times in minutes.
        window_size: Maximum recent completed service times to consider.
        active_counters: Number of active service counters.

    Returns:
        DynamicETAResult containing calculated ETA metrics.

    Raises:
        ValueError: If people_ahead, admin_service_time_minutes, active_counters, or window_size are invalid.
    """
    if people_ahead < 0:
        raise ValueError("people_ahead must be non-negative")
    if admin_service_time_minutes <= 0:
        raise ValueError("admin_service_time_minutes must be positive")
    if active_counters < 0:
        raise ValueError("active_counters must be non-negative")
    if window_size <= 0:
        raise ValueError("window_size must be positive")

    effective_counters = max(1, active_counters)

    if recent_completed_service_times is not None:
        for t in recent_completed_service_times:
            if t < 0:
                raise ValueError("Completed service times must be non-negative")

    if people_ahead == 0:
        if recent_completed_service_times and len(recent_completed_service_times) > 0:
            window = recent_completed_service_times[-window_size:]
            eff_time = round(_calculate_robust_mean(window), 2)
        else:
            eff_time = float(admin_service_time_minutes)

        return DynamicETAResult(
            estimated_wait_minutes=0.0,
            effective_service_time_minutes=max(0.0, eff_time),
            calculation_method="ZERO_PEOPLE",
            people_ahead=0,
            active_counters=active_counters,
        )

    if not recent_completed_service_times or len(recent_completed_service_times) == 0:
        eff_time = float(admin_service_time_minutes)
        method = "DEFAULT_ADMIN"
    else:
        window = recent_completed_service_times[-window_size:]
        eff_time = round(_calculate_robust_mean(window), 2)
        method = "HISTORICAL_SMOOTHED"

    estimated_wait = round((people_ahead * eff_time) / effective_counters, 2)
    estimated_wait = max(0.0, estimated_wait)

    return DynamicETAResult(
        estimated_wait_minutes=estimated_wait,
        effective_service_time_minutes=max(0.0, eff_time),
        calculation_method=method,
        people_ahead=people_ahead,
        active_counters=active_counters,
    )
