"""Pydantic schemas for Facility data validation, creation, update, and responses."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.facility import FacilityType


class FacilityBase(BaseModel):
    """Base schema with shared facility fields."""
    name: str = Field(..., min_length=1, max_length=255, description="Name of the healthcare facility")
    facility_type: FacilityType = Field(..., description="Healthcare tier classification")
    address: str = Field(..., min_length=1, description="Physical address of the facility")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate (-90 to +90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate (-180 to +180)")
    contact_phone: Optional[str] = Field(None, max_length=50, description="Phone contact")
    contact_email: Optional[str] = Field(None, max_length=100, description="Email contact")
    contact_info: Optional[str] = Field(None, description="General contact and operating info")
    is_active: bool = Field(True, description="Active status of the facility")

    @field_validator("name", "address")
    @classmethod
    def validate_non_empty_strings(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or whitespace only")
        return v.strip()


class FacilityCreate(FacilityBase):
    """Schema for creating a new facility."""
    id: Optional[str] = Field(None, max_length=64, description="Optional custom facility ID")


class FacilityUpdate(BaseModel):
    """Schema for updating an existing facility."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    facility_type: Optional[FacilityType] = None
    address: Optional[str] = Field(None, min_length=1)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    contact_info: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("name", "address")
    @classmethod
    def validate_optional_non_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Field cannot be empty or whitespace only")
        return v.strip() if v is not None else None


class FacilityResponse(FacilityBase):
    """Schema for returning facility details."""
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FacilityDistanceResponse(FacilityResponse):
    """Schema for returning facility with computed Haversine distance."""
    distance_km: Optional[float] = Field(None, description="Computed Haversine distance in kilometers")
