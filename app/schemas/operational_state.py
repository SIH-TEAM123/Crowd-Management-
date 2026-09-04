"""Pydantic schemas for Unified Facility Operational State and Camera Telemetry."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class CameraTelemetryPublish(BaseModel):
    """Payload schema for publishing real camera crowd telemetry."""
    camera_id: str = Field(..., min_length=1, max_length=64, description="Camera device identifier")
    people_count: int = Field(..., ge=0, description="Real person count detected by vision pipeline")
    timestamp: Optional[datetime] = Field(None, description="Observation timestamp (defaults to current UTC)")
    location_type: Optional[str] = Field("waiting_area", max_length=50, description="Location context inside facility")

    @field_validator("camera_id")
    @classmethod
    def validate_camera_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Camera ID cannot be empty or whitespace only")
        return v.strip()


class CameraTelemetryResponse(BaseModel):
    """Response schema for registered camera telemetry."""
    facility_id: str
    camera_id: str
    people_count: int
    timestamp: datetime
    location_type: str

    model_config = ConfigDict(from_attributes=True)


class FacilityOperationalState(BaseModel):
    """Unified real-time operational state of a healthcare facility."""
    facility_id: str
    facility_name: str
    facility_type: str
    is_active: bool

    # Queue & Crowd metrics (Strict NULL when no real source exists)
    current_crowd: Optional[int] = Field(None, description="Real crowd count from camera telemetry (null if none)")
    queue_length: Optional[int] = Field(None, description="Real active appointment queue length count (null if none)")
    current_serving: Optional[int] = Field(None, description="Current number of patients being served in consultation (null if none)")
    people_present: Optional[int] = Field(None, description="Total people present in queue and consultation (null if none)")
    predicted_wait: Optional[float] = Field(None, description="Predicted wait time in minutes from Person 3 model (null if no queue data)")
    estimated_wait: Optional[float] = Field(None, description="Estimated wait time in minutes (null if none)")
    service_capacity: Optional[int] = Field(None, description="Active configured service capacity (null if unconfigured)")

    # Specialist metrics
    specialists_total: int = Field(..., ge=0, description="Total registered specialists at facility")
    specialists_available: int = Field(..., ge=0, description="Currently available specialists")

    # Diagnostic test metrics
    diagnostics_total: int = Field(..., ge=0, description="Total diagnostic test offerings")
    diagnostics_available: int = Field(..., ge=0, description="Currently operational diagnostic offerings")

    # Medicine inventory metrics
    medicines_in_stock: int = Field(..., ge=0, description="Medicine items with positive stock (quantity > 0)")
    medicines_out_of_stock: int = Field(..., ge=0, description="Medicine items with zero on-hand stock")

    # Referral metrics
    referrals_in_progress: int = Field(..., ge=0, description="Active referrals currently in transit or in progress")
    referrals_incoming: int = Field(0, ge=0, description="Total incoming referrals to this facility")
    referrals_outgoing: int = Field(0, ge=0, description="Total outgoing referrals from this facility")

    # Emergency metrics (Strict NULL when no emergency stream exists)
    emergency_load: Optional[float] = Field(None, description="Emergency load priority score (null if none)")

    # Timestamp & Provenance
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="State observation timestamp")
    data_sources: Dict[str, str] = Field(default_factory=dict, description="Audit evidence mapping metric to exact source")

    model_config = ConfigDict(from_attributes=True)
