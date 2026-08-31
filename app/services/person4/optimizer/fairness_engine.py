"""Fairness engine module for Person 4.

Evaluates operational candidate actions against generic priority rules and fairness constraints
in a deterministic, rule-based manner.
"""

from enum import Enum
from pydantic import BaseModel, Field
from app.services.person4.models.input_models import OptimizationInput
from app.services.person4.models.output_models import ActionType


class FairnessEvaluationStatus(str, Enum):
    """Fairness evaluation classification status."""
    EVALUATED = "EVALUATED"
    LIMITED_DATA = "LIMITED_DATA"
    VIOLATION = "VIOLATION"


class FairnessEvaluationResult(BaseModel):
    """Result container for fairness constraint and score evaluation."""
    fairness_score: float = Field(..., ge=0.0, le=1.0, description="Fairness score from 0.0 to 1.0")
    priority_users_protected: bool = Field(..., description="Flag indicating if priority users are protected")
    constraint_satisfied: bool = Field(..., description="Flag indicating if fairness constraints are satisfied")
    evaluation_status: FairnessEvaluationStatus = Field(..., description="Evaluation status enum")
    reason: str = Field(..., description="Human-readable explanation of fairness evaluation")


def evaluate_fairness(
    input_data: OptimizationInput, action: ActionType
) -> FairnessEvaluationResult:
    """Evaluates fairness constraints and score for a given candidate ActionType.

    Args:
        input_data: Validated OptimizationInput payload.
        action: Candidate ActionType to evaluate.

    Returns:
        FairnessEvaluationResult containing scores, protection status, and explanations.

    Raises:
        TypeError: If input_data is not an OptimizationInput or action is not an ActionType.
    """
    if not isinstance(input_data, OptimizationInput):
        raise TypeError("input_data must be an instance of OptimizationInput")
    if not isinstance(action, ActionType):
        raise TypeError("action must be an instance of ActionType")

    has_priority_users = (
        input_data.priority.time_critical_users > 0
        or input_data.priority.vulnerable_users > 0
    )

    if action == ActionType.NO_ACTION:
        return FairnessEvaluationResult(
            fairness_score=1.0,
            priority_users_protected=has_priority_users,
            constraint_satisfied=True,
            evaluation_status=FairnessEvaluationStatus.EVALUATED,
            reason=(
                "Baseline action maintains queue allocation without denying priority users (time-critical or vulnerable)."
                if has_priority_users
                else "No priority users present; baseline action satisfies queue fairness constraints."
            ),
        )

    elif action == ActionType.OPEN_COUNTER:
        return FairnessEvaluationResult(
            fairness_score=1.0,
            priority_users_protected=has_priority_users,
            constraint_satisfied=True,
            evaluation_status=FairnessEvaluationStatus.EVALUATED,
            reason=(
                "Opening an additional counter increases queue capacity, serving general queue while protecting time-critical and vulnerable users."
                if has_priority_users
                else "Opening an additional counter increases overall service capacity; no priority users present."
            ),
        )

    elif action == ActionType.REALLOCATE_RESOURCE:
        if has_priority_users:
            return FairnessEvaluationResult(
                fairness_score=0.8,
                priority_users_protected=True,
                constraint_satisfied=True,
                evaluation_status=FairnessEvaluationStatus.LIMITED_DATA,
                reason="Resource reallocation increases service rate; time-critical and vulnerable priority users remain protected.",
            )
        else:
            return FairnessEvaluationResult(
                fairness_score=1.0,
                priority_users_protected=False,
                constraint_satisfied=True,
                evaluation_status=FairnessEvaluationStatus.EVALUATED,
                reason="Resource reallocation evaluated; no priority users present to be impacted.",
            )

    elif action == ActionType.PRIORITY_ADJUSTMENT:
        if has_priority_users:
            return FairnessEvaluationResult(
                fairness_score=0.8,
                priority_users_protected=True,
                constraint_satisfied=True,
                evaluation_status=FairnessEvaluationStatus.LIMITED_DATA,
                reason="Priority adjustment protects time-critical and vulnerable users while preventing normal user queue starvation.",
            )
        else:
            return FairnessEvaluationResult(
                fairness_score=0.0,
                priority_users_protected=False,
                constraint_satisfied=False,
                evaluation_status=FairnessEvaluationStatus.VIOLATION,
                reason="Priority adjustment requested, but no eligible time-critical or vulnerable priority users are present in the queue.",
            )

