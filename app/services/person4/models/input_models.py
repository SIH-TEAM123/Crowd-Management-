"""Input data models for Person 4 optimization module.

Defines the data contract for operational queue state, Person 3 predictions,
available resources, and priority user counts.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class CongestionLevel(str, Enum):
    """Constrained set of predicted congestion levels."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class CurrentOperationalState(BaseModel):
    """Current operational state of the queue and service counters."""
    active_counters: int = Field(..., ge=0, description="Active service counters count")
    queue_length: int = Field(..., ge=0, description="Current queue length count")
    arrival_rate_per_min: float = Field(..., ge=0.0, description="Arrival rate per minute")
    service_rate_per_counter_per_min: float = Field(..., ge=0.0, description="Service rate per counter per minute")
    average_wait_minutes: float = Field(..., ge=0.0, description="Average wait time in minutes")
    utilization: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Resource utilization ratio (0.0 to 1.0)"
    )
    completed_service_times: List[float] = Field(
        default_factory=list,
        description="Recently completed token service durations in minutes"
    )

    @field_validator("completed_service_times")
    @classmethod
    def validate_service_times(cls, v: List[float]) -> List[float]:
        for val in v:
            if val < 0:
                raise ValueError("Completed service times must be non-negative")
        return v


class Prediction(BaseModel):
    """Person 3 AI model forecast predictions."""
    forecast_horizon_minutes: int = Field(..., gt=0, description="Forecast horizon in minutes (must be > 0)")
    predicted_queue_length: int = Field(..., ge=0, description="Predicted queue length count")
    predicted_arrival_rate_per_min: float = Field(..., ge=0.0, description="Predicted arrival rate per minute")
    predicted_wait_minutes: float = Field(..., ge=0.0, description="Predicted wait time in minutes")
    predicted_congestion_level: CongestionLevel = Field(..., description="Predicted congestion level enum")
    prediction_confidence: float = Field(..., ge=0.0, le=1.0, description="Prediction confidence score (0.0 to 1.0)")


class ResourceState(BaseModel):
    """Available resources for optimization interventions."""
    spare_counters: int = Field(..., ge=0, description="Spare counters available for activation")
    reallocatable_resources: int = Field(..., ge=0, description="Reallocatable resources count")


class PriorityInfo(BaseModel):
    """Legitimately eligible priority user counts."""
    time_critical_users: int = Field(..., ge=0, description="Time-critical priority users count")
    vulnerable_users: int = Field(..., ge=0, description="Vulnerable priority users count")


class OptimizationInput(BaseModel):
    """Root input data model passed from Person 3/Person 2 to Person 4."""
    facility_id: str = Field(..., min_length=1, description="Unique facility identifier")
    institution_type: Optional[str] = Field(None, description="Optional facility/institution descriptor")
    timestamp: datetime = Field(..., description="Timestamp of the operational state")
    current_state: CurrentOperationalState
    prediction: Prediction
    resources: ResourceState
    priority: PriorityInfo

