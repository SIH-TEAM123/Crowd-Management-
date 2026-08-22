"""What-If Scenario Simulator module for Person 4.

Estimates the projected operational effects (queue length, wait time, utilization, cost)
of applying a candidate ActionType to the predicted operational state.

Simulation Assumptions & Formulas:
1. NO_ACTION:
   - Uses baseline predictions without changes.
   - Resource cost: 0.

2. OPEN_COUNTER:
   - Feasible only if input_data.resources.spare_counters > 0.
   - Increases physical active counters by 1.
   - Resource cost: 1 unit.

3. REALLOCATE_RESOURCE:
   - Feasible only if input_data.resources.reallocatable_resources > 0.
   - Physical active counter count is unchanged.
   - Increases effective service capacity per counter by 10% (multiplier = 1.10).
   - Resource cost: 1 unit.

4. PRIORITY_ADJUSTMENT:
   - Feasible only if time_critical_users > 0 or vulnerable_users > 0.
   - Does NOT alter overall physical capacity, total queue length, utilization, or total wait time.
   - Resource cost: 0 units.

Calculations (when feasible):
- Effective Service Capacity = effective_active_counters * service_rate_per_counter * capacity_multiplier
- Predicted Utilization = min(1.0, max(0.0, arrival_rate / effective_service_capacity)) [1.0 if capacity == 0]
- Net Flow = arrival_rate - effective_service_capacity
- Projected Queue Length = max(0, round(baseline_queue + net_flow * forecast_horizon))
- Projected Wait Minutes = projected_queue / effective_service_capacity [baseline_wait if capacity == 0]
"""

from pydantic import BaseModel, Field
from app.services.person4.models.input_models import OptimizationInput
from app.services.person4.models.output_models import ActionType


class ScenarioSimulationResult(BaseModel):
    """Result of simulating a candidate what-if action."""
    action: ActionType = Field(..., description="The evaluated action type")
    predicted_queue_length: int = Field(..., ge=0, description="Projected queue length after action")
    predicted_wait_minutes: float = Field(..., ge=0.0, description="Projected average wait time in minutes")
    predicted_utilization: float = Field(..., ge=0.0, le=1.0, description="Projected utilization ratio (0.0 to 1.0)")
    resource_cost: int = Field(..., ge=0, description="Abstract resource cost units required")
    feasible: bool = Field(..., description="Feasibility flag for the candidate action")


def simulate_scenario(
    input_data: OptimizationInput, action: ActionType
) -> ScenarioSimulationResult:
    """Simulates the projected operational effects of a candidate ActionType.

    Args:
        input_data: Validated OptimizationInput state payload.
        action: Candidate ActionType to simulate.

    Returns:
        ScenarioSimulationResult containing projected operational metrics.

    Raises:
        TypeError: If input_data is not an OptimizationInput or action is not an ActionType.
    """
    if not isinstance(input_data, OptimizationInput):
        raise TypeError("input_data must be an instance of OptimizationInput")
    if not isinstance(action, ActionType):
        raise TypeError("action must be an instance of ActionType")

    baseline_queue = input_data.prediction.predicted_queue_length
    baseline_wait = input_data.prediction.predicted_wait_minutes
    arrival_rate = input_data.prediction.predicted_arrival_rate_per_min
    horizon = input_data.prediction.forecast_horizon_minutes
    active_counters = input_data.current_state.active_counters
    service_rate = input_data.current_state.service_rate_per_counter_per_min

    # 1. Feasibility check and Action Configuration
    if action == ActionType.NO_ACTION:
        feasible = True
        effective_counters = active_counters
        capacity_multiplier = 1.0
        resource_cost = 0

    elif action == ActionType.OPEN_COUNTER:
        feasible = input_data.resources.spare_counters > 0
        if not feasible:
            # Return infeasible result
            base_capacity = active_counters * service_rate
            base_util = 1.0 if base_capacity == 0 else min(1.0, max(0.0, arrival_rate / base_capacity))
            return ScenarioSimulationResult(
                action=action,
                predicted_queue_length=baseline_queue,
                predicted_wait_minutes=baseline_wait,
                predicted_utilization=base_util,
                resource_cost=0,
                feasible=False,
            )
        effective_counters = active_counters + 1
        capacity_multiplier = 1.0
        resource_cost = 1

    elif action == ActionType.REALLOCATE_RESOURCE:
        feasible = input_data.resources.reallocatable_resources > 0
        if not feasible:
            base_capacity = active_counters * service_rate
            base_util = 1.0 if base_capacity == 0 else min(1.0, max(0.0, arrival_rate / base_capacity))
            return ScenarioSimulationResult(
                action=action,
                predicted_queue_length=baseline_queue,
                predicted_wait_minutes=baseline_wait,
                predicted_utilization=base_util,
                resource_cost=0,
                feasible=False,
            )
        effective_counters = active_counters
        capacity_multiplier = 1.10  # 10% efficiency boost in effective service rate
        resource_cost = 1

    elif action == ActionType.PRIORITY_ADJUSTMENT:
        feasible = (
            input_data.priority.time_critical_users > 0
            or input_data.priority.vulnerable_users > 0
        )
        if not feasible:
            base_capacity = active_counters * service_rate
            base_util = 1.0 if base_capacity == 0 else min(1.0, max(0.0, arrival_rate / base_capacity))
            return ScenarioSimulationResult(
                action=action,
                predicted_queue_length=baseline_queue,
                predicted_wait_minutes=baseline_wait,
                predicted_utilization=base_util,
                resource_cost=0,
                feasible=False,
            )
        # Priority adjustment does not change total capacity or overall wait/queue metrics
        effective_counters = active_counters
        capacity_multiplier = 1.0
        resource_cost = 0

    # 2. Capacity & Utilization Calculation
    effective_service_capacity = effective_counters * service_rate * capacity_multiplier

    if effective_service_capacity == 0:
        predicted_utilization = 1.0
    else:
        predicted_utilization = min(1.0, max(0.0, arrival_rate / effective_service_capacity))

    # 3. Queue Length & Wait Time Projections
    if action == ActionType.NO_ACTION or action == ActionType.PRIORITY_ADJUSTMENT:
        predicted_queue = baseline_queue
        predicted_wait = baseline_wait
    else:
        net_flow = arrival_rate - effective_service_capacity
        predicted_queue = max(0, int(round(baseline_queue + net_flow * horizon)))

        if effective_service_capacity == 0:
            predicted_wait = baseline_wait
        else:
            predicted_wait = max(0.0, round(predicted_queue / effective_service_capacity, 2))

    return ScenarioSimulationResult(
        action=action,
        predicted_queue_length=predicted_queue,
        predicted_wait_minutes=predicted_wait,
        predicted_utilization=round(predicted_utilization, 4),
        resource_cost=resource_cost,
        feasible=True,
    )
