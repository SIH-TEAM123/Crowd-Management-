"""Main entry point for Person 4 optimization and decision engine module.

Serves as the primary execution interface for accepting queue state/predictions
and returning optimized action recommendations.
"""

from models.input_models import OptimizationInput
from models.output_models import OptimizationOutput
from optimizer.optimizer import optimize

__all__ = ["optimize", "OptimizationInput", "OptimizationOutput"]
