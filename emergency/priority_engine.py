"""Emergency priority scoring and fairness evaluation engine."""

from typing import Any, Dict, Optional
from emergency.emergency_rules import EmergencyEvent, SEVERITY_LEVELS
from models.input_models import OptimizationInput
from models.output_models import ActionType
from optimizer.fairness_engine import (
    FairnessEvaluationResult,
    FairnessEvaluationStatus,
    evaluate_fairness,
)


def calculate_emergency_priority_score(event: Optional[EmergencyEvent]) -> float:
    """Calculate deterministic emergency priority score based on severity.

    Critical = 1.0, High = 0.8, Medium = 0.5, Low = 0.2.
    Ineligible or inactive emergency events return 0.0.

    Args:
        event: Validated EmergencyEvent object.

    Returns:
        float: Priority score between 0.0 and 1.0.
    """
    if event is None or not isinstance(event, EmergencyEvent):
        return 0.0

    if not event.eligible or not event.emergency_active:
        return 0.0

    sev = str(event.severity).strip().lower()
    return float(SEVERITY_LEVELS.get(sev, 0.0))


def evaluate_emergency_fairness(
    input_data: OptimizationInput,
    event: Optional[EmergencyEvent],
    action: ActionType,
) -> Dict[str, Any]:
    """Evaluate candidate action against Person 4 fairness rules with emergency context.

    Integrates with Person 4's existing `evaluate_fairness` without replacing it.

    Args:
        input_data: Person 4 OptimizationInput payload.
        event: Validated EmergencyEvent payload.
        action: Candidate ActionType to evaluate.

    Returns:
        Dict[str, Any]: Combined fairness evaluation result containing emergency score,
                       resource compliance, fairness score, and rationale.
    """
    if not isinstance(input_data, OptimizationInput):
        raise TypeError("input_data must be an instance of OptimizationInput")
    if not isinstance(action, ActionType):
        raise TypeError("action must be an instance of ActionType")

    # 1. Execute existing Person 4 baseline fairness evaluation
    base_fairness: FairnessEvaluationResult = evaluate_fairness(input_data, action)

    priority_score = calculate_emergency_priority_score(event)
    is_emergency_active = event is not None and event.eligible and event.emergency_active

    # 2. Evaluate resource constraints (cannot invent resources)
    resource_available = True
    resource_reason = ""

    if action == ActionType.OPEN_COUNTER and input_data.resources.spare_counters <= 0:
        resource_available = False
        resource_reason = "Cannot open additional counter: 0 spare counters available."
    elif action == ActionType.REALLOCATE_RESOURCE and input_data.resources.reallocatable_resources <= 0:
        resource_available = False
        resource_reason = "Cannot reallocate resources: 0 reallocatable resources available."

    # 3. Construct unified emergency + fairness evaluation result
    if not resource_available:
        return {
            "fairness_score": base_fairness.fairness_score,
            "priority_users_protected": base_fairness.priority_users_protected,
            "constraint_satisfied": False,
            "evaluation_status": FairnessEvaluationStatus.VIOLATION.value,
            "emergency_priority_score": priority_score,
            "emergency_active": is_emergency_active,
            "resource_feasible": False,
            "reason": f"Emergency action {action.value} infeasible. {resource_reason} {base_fairness.reason}",
        }

    if is_emergency_active:
        enhanced_reason = (
            f"Active {event.severity.upper()} healthcare emergency ('{event.emergency_type}') "
            f"at '{event.location_id}' granted priority score {priority_score:.1f}. "
            f"Action {action.value} evaluated against queue fairness: {base_fairness.reason}"
        )
        return {
            "fairness_score": base_fairness.fairness_score,
            "priority_users_protected": True,
            "constraint_satisfied": base_fairness.constraint_satisfied,
            "evaluation_status": base_fairness.evaluation_status.value,
            "emergency_priority_score": priority_score,
            "emergency_active": True,
            "resource_feasible": True,
            "reason": enhanced_reason,
        }

    # Standard non-emergency evaluation
    return {
        "fairness_score": base_fairness.fairness_score,
        "priority_users_protected": base_fairness.priority_users_protected,
        "constraint_satisfied": base_fairness.constraint_satisfied,
        "evaluation_status": base_fairness.evaluation_status.value,
        "emergency_priority_score": 0.0,
        "emergency_active": False,
        "resource_feasible": True,
        "reason": base_fairness.reason,
    }
