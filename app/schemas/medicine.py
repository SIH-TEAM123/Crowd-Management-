"""Pydantic schemas for Medicine catalog, Facility Inventory, and Stock Adjustments."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class MedicineBase(BaseModel):
    """Base schema for pharmaceutical product identity."""
    name: str = Field(..., min_length=1, max_length=255, description="Brand / trade name")
    generic_name: Optional[str] = Field(None, max_length=255, description="Active ingredient / chemical compound name")
    dosage_form: Optional[str] = Field(None, max_length=100, description="Dosage form (e.g. Tablet, Syrup, Injection)")
    strength: Optional[str] = Field(None, max_length=100, description="Concentration/strength (e.g. 500mg)")
    manufacturer: Optional[str] = Field(None, max_length=255, description="Pharmaceutical manufacturer")

    @field_validator("name")
    @classmethod
    def validate_non_empty_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Medicine name cannot be empty or whitespace only")
        return v.strip()


class MedicineCreate(MedicineBase):
    """Schema for registering a new medicine in the catalog."""
    id: Optional[str] = Field(None, max_length=64, description="Optional custom medicine ID")


class MedicineUpdate(BaseModel):
    """Schema for updating medicine catalog information."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    generic_name: Optional[str] = None
    dosage_form: Optional[str] = None
    strength: Optional[str] = None
    manufacturer: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_optional_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Medicine name cannot be empty or whitespace only")
        return v.strip() if v is not None else None


class MedicineResponse(MedicineBase):
    """Response schema for medicine catalog items."""
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FacilityInventoryBase(BaseModel):
    """Base schema for facility-level medicine inventory."""
    facility_id: str = Field(..., min_length=1, max_length=64, description="Healthcare facility ID")
    medicine_id: str = Field(..., min_length=1, max_length=64, description="Medicine product ID")
    quantity: int = Field(..., ge=0, description="Current on-hand stock quantity (must be >= 0)")
    unit: str = Field("units", max_length=50, description="Dispensing unit (e.g. tablets, strips, vials)")
    batch_number: Optional[str] = Field(None, max_length=100, description="Batch / lot number")
    expiry_date: Optional[datetime] = Field(None, description="Batch expiration timestamp")

    @field_validator("facility_id", "medicine_id")
    @classmethod
    def validate_non_empty_ids(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("ID fields cannot be empty or whitespace only")
        return v.strip()


class FacilityInventoryCreate(FacilityInventoryBase):
    """Schema for adding or initializing facility stock."""
    id: Optional[str] = Field(None, max_length=64, description="Optional custom inventory ID")


class FacilityInventoryUpdate(BaseModel):
    """Schema for directly updating inventory metadata or absolute stock."""
    quantity: Optional[int] = Field(None, ge=0, description="Absolute stock quantity (must be >= 0)")
    unit: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None


class InventoryStockAdjustment(BaseModel):
    """Schema for atomic safe dispensing or restock adjustment."""
    delta_quantity: int = Field(..., description="Quantity delta: positive to restock, negative to dispense/deduct")
    reason: Optional[str] = Field(None, description="Reason for stock movement (e.g. Dispensed to Rx #1234, Shipment batch #5)")


class FacilityInventoryResponse(FacilityInventoryBase):
    """Response schema for facility inventory with derived availability status."""
    id: str
    is_available: bool
    availability_status: str
    medicine_name: Optional[str] = None
    generic_name: Optional[str] = None
    facility_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MedicineFacilityAvailabilityResponse(BaseModel):
    """Response schema showing facility details and stock for a queried medicine."""
    facility_id: str
    facility_name: str
    facility_type: str
    address: str
    latitude: float
    longitude: float
    quantity: int
    unit: str
    is_available: bool
    availability_status: str
    distance_km: Optional[float] = None
