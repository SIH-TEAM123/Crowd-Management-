"""Pydantic schemas for Healthcare Department management."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class DepartmentBase(BaseModel):
    """Base schema for clinical department identity."""
    facility_id: str = Field(..., min_length=1, max_length=64, description="Parent healthcare facility ID")
    name: str = Field(..., min_length=1, max_length=100, description="Department name (e.g. General Medicine, Pediatrics)")
    description: Optional[str] = Field(None, max_length=255, description="Department scope or description")
    is_active: bool = Field(True, description="Active department status")

    @field_validator("facility_id", "name")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or whitespace only")
        return v.strip()


class DepartmentCreate(DepartmentBase):
    """Schema for registering a new department."""
    id: Optional[str] = Field(None, max_length=64, description="Optional custom department ID")


class DepartmentResponse(DepartmentBase):
    """Response schema for department data."""
    id: str
    created_at: datetime
    updated_at: datetime
    facility_name: Optional[str] = None
    doctor_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
