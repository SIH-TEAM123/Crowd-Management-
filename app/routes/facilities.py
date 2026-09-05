"""FastAPI route handlers for Facility CRUD, discovery, and distance calculations."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_admin_or_operator
from app.database import get_sync_db
from app.models.facility import FacilityType
from app.schemas.facility import (
    FacilityCreate,
    FacilityDistanceResponse,
    FacilityResponse,
    FacilityUpdate,
)
from app.services.facility_service import FacilityService

router = APIRouter(prefix="/facilities", tags=["Facilities"])


@router.get(
    "",
    response_model=List[FacilityResponse],
    summary="List healthcare facilities with optional filtering",
)
def list_facilities(
    facility_type: Optional[FacilityType] = Query(None, description="Filter by facility type"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    skip: int = Query(0, ge=0, description="Offset"),
    limit: int = Query(100, ge=1, le=500, description="Limit"),
    db: Session = Depends(get_sync_db),
):
    """Retrieve all facilities conforming to filter parameters."""
    return FacilityService.get_facilities(
        db=db,
        facility_type=facility_type,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/discovery",
    response_model=List[FacilityDistanceResponse],
    summary="Discover nearest healthcare facilities by coordinates and type",
)
def discover_facilities(
    latitude: Optional[float] = Query(None, ge=-90.0, le=90.0, description="User latitude"),
    longitude: Optional[float] = Query(None, ge=-180.0, le=180.0, description="User longitude"),
    facility_type: Optional[FacilityType] = Query(None, description="Filter by facility type"),
    max_distance_km: Optional[float] = Query(None, gt=0.0, description="Maximum search radius in km"),
    is_active: bool = Query(True, description="Filter by active status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_sync_db),
):
    """Find facilities with calculated Haversine distances, sorted by proximity."""
    if (latitude is not None and longitude is None) or (latitude is None and longitude is not None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both latitude and longitude must be provided together for distance calculations.",
        )

    return FacilityService.discover_facilities(
        db=db,
        user_lat=latitude,
        user_lon=longitude,
        facility_type=facility_type,
        max_distance_km=max_distance_km,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{facility_id}",
    response_model=FacilityResponse,
    summary="Get single facility details by ID",
)
def get_facility(
    facility_id: str,
    db: Session = Depends(get_sync_db),
):
    """Retrieve details for a specific healthcare facility."""
    facility = FacilityService.get_by_id(db, facility_id)
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility with ID '{facility_id}' not found.",
        )
    return facility


@router.post(
    "",
    response_model=FacilityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new healthcare facility (Protected)",
)
def create_facility(
    facility_in: FacilityCreate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Register a new healthcare facility. Requires valid admin or operator credentials."""
    if facility_in.id:
        existing = FacilityService.get_by_id(db, facility_in.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Facility with ID '{facility_in.id}' already exists.",
            )

    return FacilityService.create_facility(db, facility_in)


@router.put(
    "/{facility_id}",
    response_model=FacilityResponse,
    summary="Update facility details (Protected)",
)
def update_facility(
    facility_id: str,
    facility_in: FacilityUpdate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Update details of an existing facility. Requires valid admin or operator credentials."""
    updated = FacilityService.update_facility(db, facility_id, facility_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility with ID '{facility_id}' not found.",
        )
    return updated


@router.delete(
    "/{facility_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate or delete a facility (Protected)",
)
def delete_facility(
    facility_id: str,
    soft_delete: bool = Query(True, description="Soft delete (set is_active=False) vs permanent removal"),
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Deactivate or remove a healthcare facility. Requires valid admin or operator credentials."""
    success = FacilityService.delete_facility(db, facility_id, soft_delete=soft_delete)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility with ID '{facility_id}' not found.",
        )
    action = "deactivated" if soft_delete else "permanently deleted"
    return {"status": "success", "message": f"Facility '{facility_id}' {action} successfully."}
