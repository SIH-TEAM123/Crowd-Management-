"""Output builder module for Person 4.

Converts internal DecisionResult and OptimizationInput into the public
OptimizationOutput Pydantic schema required by Person 5 / Backend API.
"""

from typing import List, Optional

from app.services.person4.models.input_models import CongestionLevel, OptimizationInput

from app.services.person4.models.output_models import (
    ActionType,
    AlternativeScenario,
    DecisionInfo,
    DecisionStatus,
    FairnessInfo,
    ImpactInfo,
    OptimizationOutput,
    RecommendedAction,
    ResourceRequirement,
)

from app.services.person4.optimizer.decision_engine import (
    DecisionResult,
    EvaluatedScenario,
)


def derive_congestion_level(utilization: float) -> CongestionLevel:
    """Derives projected operational congestion level based on utilization.

    Classification rules:
    - 0.0 to 0.60 -> LOW
    - > 0.60 to 0.80 -> MEDIUM
    - > 0.80 to 0.95 -> HIGH
    - > 0.95 -> CRITICAL
    """
    if utilization <= 0.60:
        return CongestionLevel.LOW
    elif utilization <= 0.80:
        return CongestionLevel.MEDIUM
    elif utilization <= 0.95:
        return CongestionLevel.HIGH
    else:
        return CongestionLevel.CRITICAL


def build_optimization_output(
    input_data: OptimizationInput, decision_result: DecisionResult
) -> OptimizationOutput:
    """Adapts internal DecisionResult into the public OptimizationOutput model.

    Args:
        input_data: Validated OptimizationInput payload.
        decision_result: Validated DecisionResult payload from decision engine.

    Returns:
        OptimizationOutput matching Person 4 public data contract.

    Raises:
        TypeError: If input_data or decision_result are not of the expected types.
        ValueError: If no selected scenario is found or if selected scenario is invalid/infeasible.
    """
    if not isinstance(input_data, OptimizationInput):
        raise TypeError("input_data must be an instance of OptimizationInput")
    if not isinstance(decision_result, DecisionResult):
        raise TypeError("decision_result must be an instance of DecisionResult")

    # 1. Find matching selected scenario
    selected_action = decision_result.selected_action
    selected_scenario: Optional[EvaluatedScenario] = None

    for scenario in decision_result.evaluated_scenarios:
        if scenario.action == selected_action:
            selected_scenario = scenario
            break

    if selected_scenario is None:
        raise ValueError(f"Selected action {selected_action.value} not found in evaluated scenarios")

    if not selected_scenario.feasible:
        raise ValueError(f"Selected action {selected_action.value} is marked as operationally infeasible")

    if not selected_scenario.fairness_constraint_satisfied:
        raise ValueError(f"Selected action {selected_action.value} violates fairness constraints")

    # 2. Recommended Action
    recommended_action = RecommendedAction(
        type=selected_action,
        resource=None,  # Null for NO_ACTION or unassigned specific resource ID
    )

    # 3. Decision Information
    decision_status = (
        DecisionStatus.RECOMMEND
        if selected_action != ActionType.NO_ACTION
        else DecisionStatus.NO_ACTION
    )
    decision_info = DecisionInfo(
        status=decision_status,
        score=decision_result.score,
        confidence=decision_result.confidence,
    )

    # 4. Impact Information
    congestion = derive_congestion_level(selected_scenario.predicted_utilization)
    impact_info = ImpactInfo(
        predicted_wait_minutes=selected_scenario.predicted_wait_minutes,
        predicted_queue_length=selected_scenario.predicted_queue_length,
        predicted_utilization=selected_scenario.predicted_utilization,
        congestion_level=congestion,
    )

    # 5. Resource Requirement Mapping
    if selected_action == ActionType.OPEN_COUNTER:
        counters_required = 1
        resources_required = 0
    elif selected_action == ActionType.REALLOCATE_RESOURCE:
        counters_required = 0
        resources_required = 1
    else:  # NO_ACTION or PRIORITY_ADJUSTMENT
        counters_required = 0
        resources_required = 0

    resource_req = ResourceRequirement(
        counters_required=counters_required,
        resources_required=resources_required,
    )

    # 6. Fairness Information
    has_priority = (
        input_data.priority.time_critical_users > 0
        or input_data.priority.vulnerable_users > 0
    )
    fairness_info = FairnessInfo(
        fairness_score=selected_scenario.fairness_score,
        priority_users_protected=has_priority,
        constraint_satisfied=selected_scenario.fairness_constraint_satisfied,
    )

    # 7. Alternatives List (excludes selected scenario)
    alternatives: List[AlternativeScenario] = []
    for scenario in decision_result.evaluated_scenarios:
        if scenario.action != selected_action:
            alternatives.append(
                AlternativeScenario(
                    action=scenario.action,
                    predicted_wait_minutes=scenario.predicted_wait_minutes,
                    predicted_queue_length=scenario.predicted_queue_length,
                    predicted_utilization=scenario.predicted_utilization,
                    score=scenario.score,
                    feasible=scenario.feasible and scenario.fairness_constraint_satisfied,
                )
            )

    return OptimizationOutput(
        facility_id=input_data.facility_id,
        recommended_action=recommended_action,
        decision=decision_info,
        impact=impact_info,
        resources=resource_req,
        fairness=fairness_info,
        reason=decision_result.reason,
        alternatives=alternatives,
    )
