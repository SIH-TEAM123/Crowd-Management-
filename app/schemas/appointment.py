"""Pydantic schemas for Patient Appointments and OPD Queue Management."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.appointment import AppointmentStatus


class AppointmentBase(BaseModel):
    """Base schema for patient appointment definition."""
    facility_id: str = Field(..., min_length=1, max_length=64, description="Target healthcare facility ID")
    patient_id: Optional[str] = Field(None, max_length=64, description="Optional registered patient ID")
    patient_name: str = Field(..., min_length=1, max_length=255, description="Full patient name")
    phone_number: Optional[str] = Field(None, max_length=32, description="Patient mobile phone number for SMS notifications")
    specialist_id: Optional[str] = Field(None, max_length=64, description="Optional attending specialist ID")
    department: str = Field("OPD", max_length=100, description="Department name (e.g. OPD, General Medicine)")
    slot_start_time: Optional[str] = Field(None, max_length=10, description="Booked slot start time (HH:MM)")
    slot_end_time: Optional[str] = Field(None, max_length=10, description="Booked slot end time (HH:MM)")
    notes: Optional[str] = Field(None, description="Optional clinical notes or symptoms")

    @field_validator("facility_id", "patient_name")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or whitespace only")
        return v.strip()


class AppointmentCreate(AppointmentBase):
    """Schema for booking a new appointment."""
    id: Optional[str] = Field(None, max_length=64, description="Optional custom appointment ID")
    status: AppointmentStatus = Field(AppointmentStatus.SCHEDULED, description="Initial appointment status")


class AppointmentStatusUpdate(BaseModel):
    """Schema for updating appointment status (check-in, consult, complete)."""
    status: AppointmentStatus = Field(..., description="New appointment lifecycle status")
    notes: Optional[str] = Field(None, description="Optional audit notes")


class AppointmentResponse(AppointmentBase):
    """Response schema for returning appointment and token details."""
    id: str
    token_number: Optional[int] = None
    status: AppointmentStatus
    appointment_date: datetime
    slot_start_time: Optional[str] = None
    slot_end_time: Optional[str] = None
    check_in_time: Optional[datetime] = None
    consultation_start_time: Optional[datetime] = None
    completed_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    facility_name: Optional[str] = None
    specialist_name: Optional[str] = None
    sms_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FacilityQueueSummary(BaseModel):
    """Operational queue summary metrics for a facility."""
    facility_id: str
    queue_length: int
    current_serving: int
    people_present: int
    estimated_wait_minutes: Optional[float] = None
