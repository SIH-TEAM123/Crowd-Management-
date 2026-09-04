"""Pydantic schemas for Diagnostic Tests and Diagnostic Bookings."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.diagnostic import BookingStatus, ResultStatus


class DiagnosticTestBase(BaseModel):
    """Base schema for diagnostic test definition."""
    name: str = Field(..., min_length=1, max_length=255, description="Name of the diagnostic test")
    category: Optional[str] = Field(None, max_length=100, description="Category (e.g. Pathology, Radiology)")
    facility_id: str = Field(..., min_length=1, max_length=64, description="Offering facility ID")
    is_available: bool = Field(True, description="Availability flag of diagnostic service")
    description: Optional[str] = Field(None, description="Detailed test description and preparation instructions")
    cost: Optional[float] = Field(None, ge=0.0, description="Cost of the diagnostic test")
    estimated_duration_minutes: Optional[int] = Field(None, ge=1, description="Estimated test duration in minutes")

    @field_validator("name", "facility_id")
    @classmethod
    def validate_non_empty_strings(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or whitespace only")
        return v.strip()


class DiagnosticTestCreate(DiagnosticTestBase):
    """Schema for creating a new diagnostic test."""
    id: Optional[str] = Field(None, max_length=64, description="Optional custom ID")


class DiagnosticTestUpdate(BaseModel):
    """Schema for updating an existing diagnostic test."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = None
    facility_id: Optional[str] = Field(None, min_length=1, max_length=64)
    is_available: Optional[bool] = None
    description: Optional[str] = None
    cost: Optional[float] = Field(None, ge=0.0)
    estimated_duration_minutes: Optional[int] = Field(None, ge=1)

    @field_validator("name", "facility_id")
    @classmethod
    def validate_optional_non_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Field cannot be empty or whitespace only")
        return v.strip() if v is not None else None


class DiagnosticTestResponse(DiagnosticTestBase):
    """Response schema for returning diagnostic test details."""
    id: str
    created_at: datetime
    updated_at: datetime
    facility_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DiagnosticBookingBase(BaseModel):
    """Base schema for diagnostic booking."""
    diagnostic_id: str = Field(..., min_length=1, max_length=64, description="Requested diagnostic test ID")
    facility_id: str = Field(..., min_length=1, max_length=64, description="Facility ID where test is conducted")
    patient_id: Optional[str] = Field(None, max_length=64, description="Optional patient identifier")
    patient_name: str = Field(..., min_length=1, max_length=255, description="Full name of the patient")
    notes: Optional[str] = Field(None, description="Optional clinical or administrative notes")

    @field_validator("diagnostic_id", "facility_id", "patient_name")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or whitespace only")
        return v.strip()


class DiagnosticBookingCreate(DiagnosticBookingBase):
    """Schema for creating a new diagnostic booking."""
    id: Optional[str] = Field(None, max_length=64, description="Optional custom booking ID")
    status: BookingStatus = Field(BookingStatus.REQUESTED, description="Initial booking status")
    result_status: ResultStatus = Field(ResultStatus.PENDING, description="Initial result availability status")


class DiagnosticBookingStatusUpdate(BaseModel):
    """Schema for transitioning a booking lifecycle status."""
    status: BookingStatus = Field(..., description="Target lifecycle state")
    notes: Optional[str] = Field(None, description="Optional notes detailing the transition reason")


class DiagnosticBookingResultStatusUpdate(BaseModel):
    """Schema for updating the result status of a diagnostic booking."""
    result_status: ResultStatus = Field(..., description="Target result availability status (PENDING or AVAILABLE)")
    notes: Optional[str] = Field(None, description="Optional notes regarding the result")


class DiagnosticBookingResponse(DiagnosticBookingBase):
    """Response schema for returning diagnostic booking details, queue position, and result status."""
    id: str
    status: BookingStatus
    result_status: ResultStatus = ResultStatus.PENDING
    result_available_time: Optional[datetime] = None
    queue_position: Optional[int] = None
    booking_time: datetime
    in_progress_time: Optional[datetime] = None
    completed_time: Optional[datetime] = None
    cancelled_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    diagnostic_name: Optional[str] = None
    facility_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DiagnosticQueueItem(BaseModel):
    """Individual queued booking entry."""
    booking_id: str
    patient_name: str
    patient_id: Optional[str] = None
    status: BookingStatus
    result_status: ResultStatus = ResultStatus.PENDING
    queue_position: int
    booking_time: datetime
    estimated_wait_minutes: Optional[float] = None


class DiagnosticQueueSummary(BaseModel):
    """Operational queue summary for a specific diagnostic test or facility."""
    facility_id: str
    facility_name: Optional[str] = None
    diagnostic_id: Optional[str] = None
    diagnostic_name: Optional[str] = None
    waiting_count: int
    in_progress_count: int
    total_active: int
    estimated_wait_minutes: Optional[float] = None
    queue: List[DiagnosticQueueItem] = Field(default_factory=list)


class DiagnosticQueuePositionResponse(BaseModel):
    """Detailed queue position information for a patient's booking."""
    booking_id: str
    diagnostic_id: str
    diagnostic_name: Optional[str] = None
    facility_id: str
    facility_name: Optional[str] = None
    patient_name: str
    status: BookingStatus
    result_status: ResultStatus
    queue_position: Optional[int] = None
    people_ahead: Optional[int] = None
    estimated_wait_minutes: Optional[float] = None
