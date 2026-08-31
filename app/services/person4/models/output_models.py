"""Output data models for Person 4 optimization module.

Defines the data contract for recommendations, decision metrics, impact analysis,
resource requirements, fairness evaluations, scenario alternatives, and explanations.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

from app.services.person4.models.input_models import CongestionLevel


class ActionType(str, Enum):
    """Supported optimization intervention action types."""
    NO_ACTION = "NO_ACTION"
    OPEN_COUNTER = "OPEN_COUNTER"
    REALLOCATE_RESOURCE = "REALLOCATE_RESOURCE"
    PRIORITY_ADJUSTMENT = "PRIORITY_ADJUSTMENT"


class DecisionStatus(str, Enum):
    """Decision recommendation status."""
    RECOMMEND = "RECOMMEND"
    NO_ACTION = "NO_ACTION"


class RecommendedAction(BaseModel):
    """Recommended optimization action."""
    type: ActionType = Field(..., description="Action type enum")
    resource: Optional[str] = Field(None, description="Identifier of resource to modify (null for NO_ACTION)")


class DecisionInfo(BaseModel):
    """Decision scoring and process confidence metrics."""
    status: DecisionStatus = Field(..., description="Decision status enum")
    score: float = Field(..., ge=0.0, le=1.0, description="Optimization decision score (0.0 to 1.0)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Decision confidence score based on evaluation and input confidence (0.0 to 1.0)")


class ImpactInfo(BaseModel):
    """Predicted operational impact metrics resulting from recommended action."""
    predicted_wait_minutes: float = Field(..., ge=0.0, description="Predicted wait time after action")
    predicted_queue_length: int = Field(..., ge=0, description="Predicted queue length after action")
    predicted_utilization: float = Field(..., ge=0.0, le=1.0, description="Predicted utilization ratio (0.0 to 1.0)")
    congestion_level: CongestionLevel = Field(..., description="Predicted congestion level after action")


class ResourceRequirement(BaseModel):
    """Resources required to execute the recommended action."""
    counters_required: int = Field(..., ge=0, description="Number of additional counters required")
    resources_required: int = Field(..., ge=0, description="Number of additional resources required")


class FairnessInfo(BaseModel):
    """Fairness evaluation metrics and constraint check results."""
    fairness_score: float = Field(..., ge=0.0, le=1.0, description="Fairness score (0.0 to 1.0)")
    priority_users_protected: bool = Field(..., description="Flag indicating if priority users are protected")
    constraint_satisfied: bool = Field(..., description="Flag indicating if fairness constraints are satisfied")


class AlternativeScenario(BaseModel):
    """Alternative what-if scenario evaluated during optimization."""
    action: ActionType = Field(..., description="Candidate action type")
    predicted_wait_minutes: float = Field(..., ge=0.0, description="Estimated wait minutes for this alternative")
    predicted_queue_length: int = Field(..., ge=0, description="Estimated queue length for this alternative")
    predicted_utilization: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Estimated utilization ratio for this alternative"
    )
    score: float = Field(..., ge=0.0, le=1.0, description="Overall score for this alternative (0.0 to 1.0)")
    feasible: bool = Field(..., description="Feasibility flag for this candidate scenario")


class OptimizationOutput(BaseModel):
    """Root output model returned by Person 4 to Person 5 backend."""
    facility_id: str = Field(..., min_length=1, description="Unique facility identifier")
    recommended_action: RecommendedAction
    decision: DecisionInfo
    impact: ImpactInfo
    resources: ResourceRequirement
    fairness: FairnessInfo
    reason: str = Field(..., description="Human-readable explanation of why the action was recommended")
    alternatives: List[AlternativeScenario] = Field(default_factory=list, description="Evaluated alternative scenarios")
