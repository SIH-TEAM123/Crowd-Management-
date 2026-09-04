"""Pydantic schemas for Specialist validation, serialization, creation, updates, and OPD slot management."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.specialist import AvailabilityStatus


class SpecialistBase(BaseModel):
    """Base schema with shared specialist attributes."""
    name: str = Field(..., min_length=1, max_length=255, description="Full name of medical specialist / doctor")
    specialization: str = Field(..., min_length=1, max_length=100, description="Medical specialization (e.g., Cardiology)")
    department: Optional[str] = Field(None, max_length=100, description="Assigned clinical department (e.g., General Medicine, Cardiology)")
    facility_id: str = Field(..., min_length=1, max_length=64, description="ID of assigned healthcare facility")
    availability_status: AvailabilityStatus = Field(
        AvailabilityStatus.AVAILABLE, description="Current availability state"
    )
    schedule_info: Optional[str] = Field(None, max_length=255, description="Consultation hours or duty schedule notes")
    opd_start_time: Optional[str] = Field("09:00", max_length=10, description="OPD start time (HH:MM)")
    opd_end_time: Optional[str] = Field("17:00", max_length=10, description="OPD end time (HH:MM)")
    slot_duration_minutes: Optional[int] = Field(15, ge=5, le=120, description="Duration per patient slot in minutes")
    working_days: Optional[str] = Field("Monday,Tuesday,Wednesday,Thursday,Friday,Saturday", max_length=100, description="Comma-separated working days")
    break_start_time: Optional[str] = Field("13:00", max_length=10, description="Lunch/break start time (HH:MM)")
    break_end_time: Optional[str] = Field("14:00", max_length=10, description="Lunch/break end time (HH:MM)")
    is_schedule_active: Optional[bool] = Field(True, description="Whether OPD appointment scheduling is active")
    contact_phone: Optional[str] = Field(None, max_length=50, description="Direct contact phone")
    contact_email: Optional[str] = Field(None, max_length=100, description="Contact email")

    @field_validator("name", "specialization", "facility_id")
    @classmethod
    def validate_non_empty_strings(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or whitespace only")
        return v.strip()


class SpecialistCreate(SpecialistBase):
    """Schema for registering a new specialist."""
    id: Optional[str] = Field(None, max_length=64, description="Optional custom specialist ID")


class SpecialistUpdate(BaseModel):
    """Schema for updating specialist details and availability status."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    specialization: Optional[str] = Field(None, min_length=1, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    facility_id: Optional[str] = Field(None, min_length=1, max_length=64)
    availability_status: Optional[AvailabilityStatus] = None
    schedule_info: Optional[str] = None
    opd_start_time: Optional[str] = None
    opd_end_time: Optional[str] = None
    slot_duration_minutes: Optional[int] = Field(None, ge=5, le=120)
    working_days: Optional[str] = None
    break_start_time: Optional[str] = None
    break_end_time: Optional[str] = None
    is_schedule_active: Optional[bool] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None

    @field_validator("name", "specialization", "facility_id")
    @classmethod
    def validate_optional_non_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Field cannot be empty or whitespace only")
        return v.strip() if v is not None else None


class DoctorScheduleUpdate(BaseModel):
    """Schema for administrator or operator updates to doctor OPD slot schedules."""
    opd_start_time: Optional[str] = Field(None, max_length=10, description="OPD start time (HH:MM)")
    opd_end_time: Optional[str] = Field(None, max_length=10, description="OPD end time (HH:MM)")
    slot_duration_minutes: Optional[int] = Field(None, ge=5, le=120, description="Slot duration in minutes")
    working_days: Optional[str] = Field(None, max_length=100, description="Working days list")
    break_start_time: Optional[str] = Field(None, max_length=10, description="Break start (HH:MM)")
    break_end_time: Optional[str] = Field(None, max_length=10, description="Break end (HH:MM)")
    is_schedule_active: Optional[bool] = Field(None, description="Active schedule toggle")


class DoctorSlotResponse(BaseModel):
    """Schema representing an individual OPD consultation slot on a specific date."""
    slot_start_time: str = Field(..., description="Slot start time in HH:MM (e.g. 09:30)")
    slot_end_time: str = Field(..., description="Slot end time in HH:MM (e.g. 09:45)")
    is_available: bool = Field(..., description="Whether this slot is open and bookable")
    is_booked: bool = Field(default=False, description="Whether this slot already has an active appointment")
    reason: Optional[str] = Field(None, description="Explanation if slot is not available (e.g. Booked, Lunch Break, Outside OPD)")


class SpecialistResponse(SpecialistBase):
    """Response schema for returning specialist details."""
    id: str
    created_at: datetime
    updated_at: datetime
    facility_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
