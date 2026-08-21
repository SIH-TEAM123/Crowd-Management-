"""End-to-end optimizer orchestration module for Person 4.

Provides the single public entry point `optimize()` for Person 4.
Orchestrates scenario generation, simulation, fairness evaluation,
decision scoring/ranking, and public output contract conversion.
"""

from models.input_models import OptimizationInput
from models.output_models import OptimizationOutput
from optimizer.decision_engine import make_decision
from optimizer.output_builder import build_optimization_output


def optimize(input_data: OptimizationInput) -> OptimizationOutput:
    """Main orchestration entry point for Person 4 optimization module.

    Executes the full pipeline:
    1. Validates input schema
    2. Generates candidate scenarios
    3. Simulates what-if operational outcomes
    4. Evaluates fairness constraints & priority rules
    5. Scores, filters, and ranks decisions
    6. Adapts internal result to public OptimizationOutput model

    Args:
        input_data: Validated OptimizationInput payload.

    Returns:
        OptimizationOutput public API schema.

    Raises:
        TypeError: If input_data is not an instance of OptimizationInput.
        ValueError: If internal pipeline failure occurs during decision or output construction.
    """
    if not isinstance(input_data, OptimizationInput):
        raise TypeError("input_data must be an instance of OptimizationInput")

    # 1. Execute decision engine (orchestrates scenario generation, simulation, fairness & ranking)
    decision_result = make_decision(input_data)

    if not decision_result or not decision_result.evaluated_scenarios:
        raise ValueError("Decision engine produced an empty or invalid decision result")

    # 2. Convert internal DecisionResult to public OptimizationOutput
    optimization_output = build_optimization_output(input_data, decision_result)

    if not isinstance(optimization_output, OptimizationOutput):
        raise ValueError("Output builder failed to construct a valid OptimizationOutput")

    return optimization_output
