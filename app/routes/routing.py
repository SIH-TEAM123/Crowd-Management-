"""FastAPI route handlers for Intelligent Facility Recommendation and Patient Routing."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_sync_db
from app.models.facility import FacilityType
from app.models.referral import ReferralPriority
from app.schemas.routing import (
    FacilityRoutingRequest,
    FacilityRoutingResponse,
)
from app.services.routing_service import RoutingService

router = APIRouter(prefix="/facilities", tags=["Intelligent Facility Routing"])


@router.post(
    "/recommend",
    response_model=FacilityRoutingResponse,
    summary="Recommend suitable healthcare facilities based on clinical requirements and proximity (POST)",
)
def recommend_facilities_post(
    request: FacilityRoutingRequest,
    db: Session = Depends(get_sync_db),
):
    """Find and rank suitable healthcare facilities matching complex clinical and geographic requirements."""
    return RoutingService.recommend_facilities(db=db, request=request)


@router.get(
    "/recommend",
    response_model=FacilityRoutingResponse,
    summary="Recommend suitable healthcare facilities (GET query parameters)",
)
def recommend_facilities_get(
    latitude: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Patient origin latitude"),
    longitude: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Patient origin longitude"),
    required_specialization: Optional[str] = Query(None, description="Required specialist expertise"),
    required_diagnostic: Optional[str] = Query(None, description="Required diagnostic test/service"),
    required_medicine: Optional[str] = Query(None, description="Required medicine name or ID"),
    required_facility_type: Optional[FacilityType] = Query(None, description="Required healthcare facility tier"),
    priority: ReferralPriority = Query(ReferralPriority.ROUTINE, description="Clinical urgency priority"),
    source_facility_id: Optional[str] = Query(None, description="Source facility ID to exclude from recommendations"),
    max_distance_km: Optional[float] = Query(None, gt=0.0, description="Max search radius in km"),
    limit: int = Query(10, ge=1, le=100, description="Max recommendations to return"),
    db: Session = Depends(get_sync_db),
):
    """Query facility recommendations using URL query parameters."""
    try:
        req = FacilityRoutingRequest(
            latitude=latitude,
            longitude=longitude,
            required_specialization=required_specialization,
            required_diagnostic=required_diagnostic,
            required_medicine=required_medicine,
            required_facility_type=required_facility_type,
            priority=priority,
            source_facility_id=source_facility_id,
            max_distance_km=max_distance_km,
            limit=limit,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    return RoutingService.recommend_facilities(db=db, request=req)
