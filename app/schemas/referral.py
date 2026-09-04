"""Pydantic schemas for Inter-Facility Healthcare Referral validation, creation, updates, and responses."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.referral import ReferralPriority, ReferralStatus


class ReferralBase(BaseModel):
    """Base schema for patient referral attributes."""
    patient_id: Optional[str] = Field(None, max_length=64, description="Optional patient registry identifier")
    patient_name: str = Field(..., min_length=1, max_length=255, description="Full name of referred patient")
    source_facility_id: str = Field(..., min_length=1, max_length=64, description="Originating healthcare facility ID")
    destination_facility_id: str = Field(..., min_length=1, max_length=64, description="Receiving healthcare facility ID")
    reason: str = Field(..., min_length=1, description="Clinical reason for referral and diagnosis notes")
    required_specialization: Optional[str] = Field(None, max_length=100, description="Required medical specialty (e.g. Cardiology)")
    required_diagnostic: Optional[str] = Field(None, max_length=255, description="Required diagnostic procedure (e.g. MRI Brain)")
    required_medicine: Optional[str] = Field(None, max_length=255, description="Required pharmaceutical product (e.g. Insulin)")
    priority: ReferralPriority = Field(ReferralPriority.ROUTINE, description="Clinical urgency priority")
    notes: Optional[str] = Field(None, description="Additional referral notes or instructions")

    @field_validator("patient_name", "source_facility_id", "destination_facility_id", "reason")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or whitespace only")
        return v.strip()


class ReferralCreate(ReferralBase):
    """Schema for registering a new inter-facility patient referral."""
    id: Optional[str] = Field(None, max_length=64, description="Optional custom referral ID")


class ReferralStatusUpdate(BaseModel):
    """Schema for progressing referral lifecycle status."""
    status: ReferralStatus = Field(..., description="Target lifecycle state")
    notes: Optional[str] = Field(None, description="Optional audit notes detailing the state change")


class ReferralResponse(ReferralBase):
    """Response schema returning referral details and lifecycle timestamps."""
    id: str
    status: ReferralStatus
    created_at: datetime
    accepted_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    updated_at: datetime
    source_facility_name: Optional[str] = None
    destination_facility_name: Optional[str] = None
    source_facility_type: Optional[str] = None
    destination_facility_type: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
