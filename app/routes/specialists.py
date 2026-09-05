"""FastAPI route handlers for Specialist CRUD, filtering, OPD schedule updates, and slot generation."""

from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_admin_or_operator
from app.database import get_sync_db
from app.models.specialist import AvailabilityStatus
from app.schemas.specialist import (
    DoctorScheduleUpdate,
    DoctorSlotResponse,
    SpecialistCreate,
    SpecialistResponse,
    SpecialistUpdate,
)
from app.services.specialist_service import SpecialistService

router = APIRouter(prefix="/specialists", tags=["Specialists"])


def _to_response(specialist) -> SpecialistResponse:
    """Helper to convert Specialist ORM model to SpecialistResponse with facility_name."""
    return SpecialistResponse(
        id=specialist.id,
        name=specialist.name,
        specialization=specialist.specialization,
        department=specialist.department or specialist.specialization,
        facility_id=specialist.facility_id,
        availability_status=specialist.availability_status,
        schedule_info=specialist.schedule_info,
        opd_start_time=specialist.opd_start_time,
        opd_end_time=specialist.opd_end_time,
        slot_duration_minutes=specialist.slot_duration_minutes,
        working_days=specialist.working_days,
        break_start_time=specialist.break_start_time,
        break_end_time=specialist.break_end_time,
        is_schedule_active=specialist.is_schedule_active,
        contact_phone=specialist.contact_phone,
        contact_email=specialist.contact_email,
        created_at=specialist.created_at,
        updated_at=specialist.updated_at,
        facility_name=specialist.facility.name if specialist.facility else None,
    )


@router.get(
    "",
    response_model=List[SpecialistResponse],
    summary="List specialists with optional filters",
)
def list_specialists(
    facility_id: Optional[str] = Query(None, description="Filter by healthcare facility ID"),
    department: Optional[str] = Query(None, description="Filter by department name"),
    specialization: Optional[str] = Query(None, description="Filter by specialization"),
    availability_status: Optional[AvailabilityStatus] = Query(None, description="Filter by status"),
    is_available_only: bool = Query(False, description="Filter only currently available specialists"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_sync_db),
):
    """Retrieve specialists filtered by facility, department, specialization, and availability status."""
    specialists = SpecialistService.get_specialists(
        db=db,
        facility_id=facility_id,
        department=department,
        specialization=specialization,
        availability_status=availability_status,
        is_available_only=is_available_only,
        skip=skip,
        limit=limit,
    )
    return [_to_response(s) for s in specialists]


@router.get(
    "/available",
    response_model=List[SpecialistResponse],
    summary="List all currently available specialists",
)
def list_available_specialists(
    facility_id: Optional[str] = Query(None, description="Filter by facility ID"),
    department: Optional[str] = Query(None, description="Filter by department name"),
    specialization: Optional[str] = Query(None, description="Filter by specialization"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_sync_db),
):
    """Retrieve only specialists who are currently marked as AVAILABLE."""
    specialists = SpecialistService.get_specialists(
        db=db,
        facility_id=facility_id,
        department=department,
        specialization=specialization,
        is_available_only=True,
        skip=skip,
        limit=limit,
    )
    return [_to_response(s) for s in specialists]


@router.get(
    "/{specialist_id}/slots",
    response_model=List[DoctorSlotResponse],
    summary="Get OPD consultation time slots for a doctor on a specific date",
)
def get_doctor_slots(
    specialist_id: str,
    date_str: Optional[str] = Query(None, alias="date", description="Target date in YYYY-MM-DD format (defaults to today)"),
    db: Session = Depends(get_sync_db),
):
    """Retrieve doctor's time slots on the specified date with availability and booking status."""
    if date_str:
        try:
            target_date = datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Please use YYYY-MM-DD.",
            )
    else:
        target_date = datetime.now(timezone.utc).date()

    try:
        slots = SpecialistService.generate_doctor_slots(db, specialist_id, target_date)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )

    return slots


@router.put(
    "/{specialist_id}/schedule",
    response_model=SpecialistResponse,
    summary="Update doctor's OPD hours, slot duration, and working days (Protected)",
)
def update_doctor_schedule(
    specialist_id: str,
    schedule_in: DoctorScheduleUpdate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Update doctor's OPD schedule configuration. Requires admin/operator credentials."""
    updated = SpecialistService.update_doctor_schedule(db, specialist_id, schedule_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Specialist with ID '{specialist_id}' not found.",
        )
    return _to_response(updated)


@router.get(
    "/{specialist_id}",
    response_model=SpecialistResponse,
    summary="Get single specialist details by ID",
)
def get_specialist(
    specialist_id: str,
    db: Session = Depends(get_sync_db),
):
    """Retrieve details for a specific medical specialist."""
    specialist = SpecialistService.get_by_id(db, specialist_id)
    if not specialist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Specialist with ID '{specialist_id}' not found.",
        )
    return _to_response(specialist)


@router.post(
    "",
    response_model=SpecialistResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new specialist (Protected)",
)
def create_specialist(
    specialist_in: SpecialistCreate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Register a new specialist. Requires valid admin/operator credentials."""
    if specialist_in.id:
        existing = SpecialistService.get_by_id(db, specialist_in.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Specialist with ID '{specialist_in.id}' already exists.",
            )

    try:
        specialist = SpecialistService.create_specialist(db, specialist_in)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    return _to_response(specialist)


@router.put(
    "/{specialist_id}",
    response_model=SpecialistResponse,
    summary="Update specialist details or availability (Protected)",
)
def update_specialist(
    specialist_id: str,
    specialist_in: SpecialistUpdate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Update specialist information or availability status. Requires valid credentials."""
    try:
        updated = SpecialistService.update_specialist(db, specialist_id, specialist_in)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Specialist with ID '{specialist_id}' not found.",
        )

    return _to_response(updated)


@router.delete(
    "/{specialist_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a specialist (Protected)",
)
def delete_specialist(
    specialist_id: str,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Remove a specialist record. Requires valid admin or operator credentials."""
    success = SpecialistService.delete_specialist(db, specialist_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Specialist with ID '{specialist_id}' not found.",
        )
    return {"status": "success", "message": f"Specialist '{specialist_id}' deleted successfully."}
