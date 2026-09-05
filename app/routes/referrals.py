"""FastAPI route handlers for Inter-Facility Patient Referrals and State Machine Transitions."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_admin_or_operator
from app.database import get_sync_db
from app.models.referral import ReferralPriority, ReferralStatus
from app.schemas.referral import (
    ReferralCreate,
    ReferralResponse,
    ReferralStatusUpdate,
)
from app.services.referral_service import ReferralService

router = APIRouter(prefix="/referrals", tags=["Inter-Facility Referrals"])


def _to_referral_response(ref) -> ReferralResponse:
    """Serialize Referral ORM object to ReferralResponse with facility names and types."""
    return ReferralResponse(
        id=ref.id,
        patient_id=ref.patient_id,
        patient_name=ref.patient_name,
        source_facility_id=ref.source_facility_id,
        destination_facility_id=ref.destination_facility_id,
        reason=ref.reason,
        required_specialization=ref.required_specialization,
        required_diagnostic=ref.required_diagnostic,
        required_medicine=ref.required_medicine,
        priority=ref.priority,
        status=ref.status,
        created_at=ref.created_at,
        accepted_at=ref.accepted_at,
        started_at=ref.started_at,
        completed_at=ref.completed_at,
        failed_at=ref.failed_at,
        notes=ref.notes,
        updated_at=ref.updated_at,
        source_facility_name=ref.source_facility.name if ref.source_facility else None,
        destination_facility_name=ref.destination_facility.name if ref.destination_facility else None,
        source_facility_type=ref.source_facility.facility_type.value if (ref.source_facility and hasattr(ref.source_facility.facility_type, "value")) else None,
        destination_facility_type=ref.destination_facility.facility_type.value if (ref.destination_facility and hasattr(ref.destination_facility.facility_type, "value")) else None,
    )


@router.post(
    "",
    response_model=ReferralResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new inter-facility patient referral (Protected)",
)
def create_referral(
    referral_in: ReferralCreate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Register a new patient referral between healthcare facilities."""
    if referral_in.id:
        existing = ReferralService.get_referral_by_id(db, referral_in.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Referral with ID '{referral_in.id}' already exists.",
            )

    try:
        ref = ReferralService.create_referral(db, referral_in)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    return _to_referral_response(ref)


@router.get(
    "",
    response_model=List[ReferralResponse],
    summary="List patient referrals with optional filters",
)
def list_referrals(
    source_facility_id: Optional[str] = Query(None, description="Filter by originating facility"),
    destination_facility_id: Optional[str] = Query(None, description="Filter by receiving facility"),
    patient_id: Optional[str] = Query(None, description="Filter by patient identifier"),
    referral_status: Optional[ReferralStatus] = Query(None, alias="status", description="Filter by status"),
    priority: Optional[ReferralPriority] = Query(None, description="Filter by urgency priority"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_sync_db),
):
    """Retrieve referrals across healthcare network facilities."""
    referrals = ReferralService.get_referrals(
        db=db,
        source_facility_id=source_facility_id,
        destination_facility_id=destination_facility_id,
        patient_id=patient_id,
        status=referral_status,
        priority=priority,
        skip=skip,
        limit=limit,
    )
    return [_to_referral_response(r) for r in referrals]


@router.get(
    "/{referral_id}",
    response_model=ReferralResponse,
    summary="Get single referral details by ID",
)
def get_referral(
    referral_id: str,
    db: Session = Depends(get_sync_db),
):
    """Retrieve details and audit history for a single referral."""
    ref = ReferralService.get_referral_by_id(db, referral_id)
    if not ref:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Referral with ID '{referral_id}' not found.",
        )
    return _to_referral_response(ref)


@router.patch(
    "/{referral_id}/status",
    response_model=ReferralResponse,
    summary="Advance referral lifecycle status (Protected)",
)
def update_referral_status(
    referral_id: str,
    status_update: ReferralStatusUpdate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Advance referral state (CREATED -> ACCEPTED -> IN_PROGRESS -> COMPLETED / FAILED / MISSED).

    Enforces strict state machine rules and records audit timestamps automatically.
    """
    try:
        updated = ReferralService.update_referral_status(
            db=db,
            referral_id=referral_id,
            new_status=status_update.status,
            notes=status_update.notes,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    return _to_referral_response(updated)
