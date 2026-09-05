"""FastAPI route handlers for Medicine Catalog and Facility Inventory Management."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_admin_or_operator
from app.database import get_sync_db
from app.schemas.medicine import (
    FacilityInventoryCreate,
    FacilityInventoryResponse,
    InventoryStockAdjustment,
    MedicineCreate,
    MedicineFacilityAvailabilityResponse,
    MedicineResponse,
    MedicineUpdate,
)
from app.services.medicine_service import MedicineService

router = APIRouter(tags=["Medicines & Inventory"])


def _to_medicine_response(med) -> MedicineResponse:
    return MedicineResponse(
        id=med.id,
        name=med.name,
        generic_name=med.generic_name,
        dosage_form=med.dosage_form,
        strength=med.strength,
        manufacturer=med.manufacturer,
        created_at=med.created_at,
        updated_at=med.updated_at,
    )


def _to_inventory_response(inv) -> FacilityInventoryResponse:
    return FacilityInventoryResponse(
        id=inv.id,
        facility_id=inv.facility_id,
        medicine_id=inv.medicine_id,
        quantity=inv.quantity,
        unit=inv.unit,
        batch_number=inv.batch_number,
        expiry_date=inv.expiry_date,
        is_available=inv.is_available,
        availability_status=inv.availability_status,
        medicine_name=inv.medicine.name if inv.medicine else None,
        generic_name=inv.medicine.generic_name if inv.medicine else None,
        facility_name=inv.facility.name if inv.facility else None,
        created_at=inv.created_at,
        updated_at=inv.updated_at,
    )


# =========================================================================
# 1. Medicine Catalog Endpoints (/medicines)
# =========================================================================

@router.get(
    "/medicines",
    response_model=List[MedicineResponse],
    summary="Search and list medicines in catalog",
)
def list_medicines(
    query: Optional[str] = Query(None, description="Search term for name or generic name"),
    generic_name: Optional[str] = Query(None, description="Filter by active generic name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_sync_db),
):
    """Search and retrieve pharmaceutical products from the master catalog."""
    medicines = MedicineService.get_medicines(
        db=db,
        query=query,
        generic_name=generic_name,
        skip=skip,
        limit=limit,
    )
    return [_to_medicine_response(m) for m in medicines]


@router.get(
    "/medicines/{medicine_id}",
    response_model=MedicineResponse,
    summary="Get medicine details by ID",
)
def get_medicine(
    medicine_id: str,
    db: Session = Depends(get_sync_db),
):
    """Retrieve details for a specific medicine."""
    med = MedicineService.get_medicine_by_id(db, medicine_id)
    if not med:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine with ID '{medicine_id}' not found.",
        )
    return _to_medicine_response(med)


@router.post(
    "/medicines",
    response_model=MedicineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new medicine in catalog (Protected)",
)
def create_medicine(
    medicine_in: MedicineCreate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Register a new pharmaceutical product. Requires valid operator/admin credentials."""
    if medicine_in.id:
        existing = MedicineService.get_medicine_by_id(db, medicine_in.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Medicine with ID '{medicine_in.id}' already exists.",
            )

    med = MedicineService.create_medicine(db, medicine_in)
    return _to_medicine_response(med)


@router.put(
    "/medicines/{medicine_id}",
    response_model=MedicineResponse,
    summary="Update medicine details (Protected)",
)
def update_medicine(
    medicine_id: str,
    medicine_in: MedicineUpdate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Update medicine metadata."""
    updated = MedicineService.update_medicine(db, medicine_id, medicine_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine with ID '{medicine_id}' not found.",
        )
    return _to_medicine_response(updated)


@router.delete(
    "/medicines/{medicine_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete medicine from catalog (Protected)",
)
def delete_medicine(
    medicine_id: str,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Delete a medicine record."""
    success = MedicineService.delete_medicine(db, medicine_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine with ID '{medicine_id}' not found.",
        )
    return {"status": "success", "message": f"Medicine '{medicine_id}' deleted successfully."}


@router.get(
    "/medicines/{medicine_id}/facilities",
    response_model=List[MedicineFacilityAvailabilityResponse],
    summary="Find facilities where requested medicine is currently in stock",
)
def find_facilities_with_medicine(
    medicine_id: str,
    min_quantity: int = Query(1, ge=1, description="Minimum on-hand quantity required"),
    latitude: Optional[float] = Query(None, ge=-90.0, le=90.0, description="User origin latitude"),
    longitude: Optional[float] = Query(None, ge=-180.0, le=180.0, description="User origin longitude"),
    max_distance_km: Optional[float] = Query(None, gt=0.0, description="Max radius in km"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_sync_db),
):
    """Locate all active healthcare facilities currently stocking a medicine."""
    med = MedicineService.get_medicine_by_id(db, medicine_id)
    if not med:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine with ID '{medicine_id}' not found.",
        )

    if (latitude is not None and longitude is None) or (latitude is None and longitude is not None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both latitude and longitude must be provided together for distance calculations.",
        )

    return MedicineService.find_facilities_with_medicine(
        db=db,
        medicine_id=medicine_id,
        min_quantity=min_quantity,
        user_lat=latitude,
        user_lon=longitude,
        max_distance_km=max_distance_km,
        skip=skip,
        limit=limit,
    )


# =========================================================================
# 2. Facility Inventory Endpoints (/facilities/{facility_id}/inventory)
# =========================================================================

@router.get(
    "/facilities/{facility_id}/inventory",
    response_model=List[FacilityInventoryResponse],
    summary="Retrieve complete medicine inventory for a facility",
)
def get_facility_inventory(
    facility_id: str,
    is_available_only: bool = Query(False, description="Filter only in-stock items (qty > 0)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_sync_db),
):
    """Fetch facility medicine stock levels."""
    records = MedicineService.get_facility_inventory(
        db=db,
        facility_id=facility_id,
        is_available_only=is_available_only,
        skip=skip,
        limit=limit,
    )
    return [_to_inventory_response(r) for r in records]


@router.post(
    "/facilities/{facility_id}/inventory",
    response_model=FacilityInventoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Set or update facility medicine stock level (Protected)",
)
def set_facility_inventory(
    facility_id: str,
    inv_in: FacilityInventoryCreate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Set absolute stock level for a medicine at a facility."""
    if inv_in.facility_id != facility_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path parameter 'facility_id' does not match payload 'facility_id'.",
        )

    try:
        inv = MedicineService.set_or_update_inventory(db, inv_in)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    return _to_inventory_response(inv)


@router.post(
    "/facilities/{facility_id}/inventory/adjust",
    response_model=FacilityInventoryResponse,
    summary="Atomically adjust inventory stock / dispense medicine (Protected)",
)
def adjust_facility_inventory_stock(
    facility_id: str,
    medicine_id: str = Query(..., description="Medicine ID to adjust"),
    adjustment: InventoryStockAdjustment = ...,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Safely increase (restock) or decrease (dispense) inventory.

    Prevents negative stock levels.
    """
    try:
        inv = MedicineService.adjust_stock(
            db=db,
            facility_id=facility_id,
            medicine_id=medicine_id,
            delta=adjustment.delta_quantity,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    return _to_inventory_response(inv)


@router.get(
    "/facilities/{facility_id}/medicines/{medicine_id}/availability",
    response_model=FacilityInventoryResponse,
    summary="Check stock level of a specific medicine at a facility",
)
def check_medicine_availability(
    facility_id: str,
    medicine_id: str,
    db: Session = Depends(get_sync_db),
):
    """Check if a specific medicine is available in facility inventory."""
    inv = MedicineService.check_facility_medicine_stock(db, facility_id, medicine_id)
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No inventory record found for medicine '{medicine_id}' at facility '{facility_id}'.",
        )
    return _to_inventory_response(inv)
