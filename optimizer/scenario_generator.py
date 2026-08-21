"""Scenario generator module for Person 4.

Determines feasible candidate operational actions based on resource state
and priority user counts present in the OptimizationInput.
"""

from typing import List
from models.input_models import OptimizationInput
from models.output_models import ActionType


def generate_scenarios(input_data: OptimizationInput) -> List[ActionType]:
    """Generates a deterministic list of feasible candidate ActionTypes.

    Rules:
    1. NO_ACTION is always included.
    2. OPEN_COUNTER is included if spare_counters > 0.
    3. REALLOCATE_RESOURCE is included if reallocatable_resources > 0.
    4. PRIORITY_ADJUSTMENT is included if time_critical_users > 0 or vulnerable_users > 0.

    Args:
        input_data: Validated OptimizationInput payload.

    Returns:
        List of candidate ActionType enums in deterministic order.

    Raises:
        TypeError: If input_data is not an instance of OptimizationInput.
    """
    if not isinstance(input_data, OptimizationInput):
        raise TypeError("input_data must be an instance of OptimizationInput")

    scenarios: List[ActionType] = [ActionType.NO_ACTION]

    if input_data.resources.spare_counters > 0:
        scenarios.append(ActionType.OPEN_COUNTER)

    if input_data.resources.reallocatable_resources > 0:
        scenarios.append(ActionType.REALLOCATE_RESOURCE)

    if (
        input_data.priority.time_critical_users > 0
        or input_data.priority.vulnerable_users > 0
    ):
        scenarios.append(ActionType.PRIORITY_ADJUSTMENT)

    return scenarios
