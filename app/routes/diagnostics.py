"""FastAPI route handlers for Diagnostic Test Catalog, Availability Lookups, and Booking Lifecycle State Machine."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_admin_or_operator
from app.database import get_sync_db
from app.models.diagnostic import BookingStatus, ResultStatus
from app.schemas.diagnostic import (
    DiagnosticBookingCreate,
    DiagnosticBookingResponse,
    DiagnosticBookingResultStatusUpdate,
    DiagnosticBookingStatusUpdate,
    DiagnosticQueuePositionResponse,
    DiagnosticQueueSummary,
    DiagnosticTestCreate,
    DiagnosticTestResponse,
    DiagnosticTestUpdate,
)
from app.services.diagnostic_service import DiagnosticService

router = APIRouter(prefix="/diagnostics", tags=["Diagnostics & Bookings"])


def _to_diag_response(diag) -> DiagnosticTestResponse:
    """Serialize DiagnosticTest ORM object."""
    return DiagnosticTestResponse(
        id=diag.id,
        name=diag.name,
        category=diag.category,
        facility_id=diag.facility_id,
        is_available=diag.is_available,
        description=diag.description,
        cost=diag.cost,
        estimated_duration_minutes=diag.estimated_duration_minutes,
        created_at=diag.created_at,
        updated_at=diag.updated_at,
        facility_name=diag.facility.name if diag.facility else None,
    )


def _to_booking_response(booking, db: Optional[Session] = None) -> DiagnosticBookingResponse:
    """Serialize DiagnosticBooking ORM object with queue position and result status."""
    q_pos = None
    if db is not None:
        q_pos = DiagnosticService.calculate_queue_position(db, booking)

    return DiagnosticBookingResponse(
        id=booking.id,
        diagnostic_id=booking.diagnostic_id,
        facility_id=booking.facility_id,
        patient_id=booking.patient_id,
        patient_name=booking.patient_name,
        status=booking.status,
        result_status=booking.result_status,
        result_available_time=booking.result_available_time,
        queue_position=q_pos,
        booking_time=booking.booking_time,
        in_progress_time=booking.in_progress_time,
        completed_time=booking.completed_time,
        cancelled_time=booking.cancelled_time,
        notes=booking.notes,
        created_at=booking.created_at,
        updated_at=booking.updated_at,
        diagnostic_name=booking.diagnostic.name if booking.diagnostic else None,
        facility_name=booking.facility.name if booking.facility else None,
    )


# =========================================================================
# 1. Diagnostic Test Catalog Endpoints
# =========================================================================

@router.get(
    "",
    response_model=List[DiagnosticTestResponse],
    summary="List diagnostic tests with optional filtering",
)
def list_diagnostics(
    facility_id: Optional[str] = Query(None, description="Filter by facility ID"),
    name: Optional[str] = Query(None, description="Search by test name"),
    category: Optional[str] = Query(None, description="Filter by category (e.g. Pathology, Radiology)"),
    is_available_only: bool = Query(False, description="Filter only available services"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_sync_db),
):
    """Retrieve diagnostic test catalog."""
    diagnostics = DiagnosticService.get_diagnostics(
        db=db,
        facility_id=facility_id,
        name=name,
        category=category,
        is_available_only=is_available_only,
        skip=skip,
        limit=limit,
    )
    return [_to_diag_response(d) for d in diagnostics]


@router.get(
    "/available",
    response_model=List[DiagnosticTestResponse],
    summary="List only currently available diagnostic tests",
)
def list_available_diagnostics(
    facility_id: Optional[str] = Query(None, description="Filter by facility ID"),
    name: Optional[str] = Query(None, description="Search by test name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_sync_db),
):
    """Retrieve only available diagnostic tests across facilities."""
    diagnostics = DiagnosticService.get_diagnostics(
        db=db,
        facility_id=facility_id,
        name=name,
        is_available_only=True,
        skip=skip,
        limit=limit,
    )
    return [_to_diag_response(d) for d in diagnostics]


@router.get(
    "/check-availability",
    summary="Check availability of a specific test at a target facility",
)
def check_test_availability(
    facility_id: str = Query(..., description="Target facility ID"),
    test_name: str = Query(..., description="Test name to check"),
    db: Session = Depends(get_sync_db),
) -> Dict[str, Any]:
    """Verify if a requested diagnostic test is available at a specific facility."""
    is_avail, diag = DiagnosticService.check_availability(db, facility_id, test_name)
    return {
        "facility_id": facility_id,
        "test_name": test_name,
        "available": is_avail,
        "diagnostic": _to_diag_response(diag) if diag else None,
    }


@router.get(
    "/facilities/{facility_id}/queue",
    response_model=List[DiagnosticQueueSummary],
    summary="Get queue summaries for all diagnostic tests at a facility",
)
def get_facility_diagnostic_queues(
    facility_id: str,
    db: Session = Depends(get_sync_db),
):
    """Retrieve operational queue status across all diagnostic offerings in a facility."""
    return DiagnosticService.get_facility_diagnostic_queues(db, facility_id)


@router.get(
    "/{diagnostic_id}/queue",
    response_model=DiagnosticQueueSummary,
    summary="Get active queue summary and waiting list for a specific diagnostic test",
)
def get_diagnostic_queue(
    diagnostic_id: str,
    db: Session = Depends(get_sync_db),
):
    """Retrieve real-time queue position and waiting patient list for a diagnostic test."""
    queue_summary = DiagnosticService.get_diagnostic_queue(db, diagnostic_id)
    if not queue_summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagnostic test with ID '{diagnostic_id}' not found.",
        )
    return queue_summary


@router.get(
    "/{diagnostic_id}",
    response_model=DiagnosticTestResponse,
    summary="Get diagnostic test details by ID",
)
def get_diagnostic(
    diagnostic_id: str,
    db: Session = Depends(get_sync_db),
):
    """Retrieve details for a single diagnostic test."""
    diag = DiagnosticService.get_diagnostic_by_id(db, diagnostic_id)
    if not diag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagnostic test with ID '{diagnostic_id}' not found.",
        )
    return _to_diag_response(diag)


@router.post(
    "",
    response_model=DiagnosticTestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new diagnostic test offering (Protected)",
)
def create_diagnostic(
    diag_in: DiagnosticTestCreate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Add a new diagnostic test to a facility catalog. Requires valid operator/admin credentials."""
    if diag_in.id:
        existing = DiagnosticService.get_diagnostic_by_id(db, diag_in.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Diagnostic test with ID '{diag_in.id}' already exists.",
            )

    try:
        diag = DiagnosticService.create_diagnostic(db, diag_in)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    return _to_diag_response(diag)


@router.put(
    "/{diagnostic_id}",
    response_model=DiagnosticTestResponse,
    summary="Update diagnostic test details (Protected)",
)
def update_diagnostic(
    diagnostic_id: str,
    diag_in: DiagnosticTestUpdate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Update diagnostic test parameters or availability."""
    try:
        updated = DiagnosticService.update_diagnostic(db, diagnostic_id, diag_in)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagnostic test with ID '{diagnostic_id}' not found.",
        )

    return _to_diag_response(updated)


@router.delete(
    "/{diagnostic_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove a diagnostic test from catalog (Protected)",
)
def delete_diagnostic(
    diagnostic_id: str,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Delete a diagnostic test record."""
    success = DiagnosticService.delete_diagnostic(db, diagnostic_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagnostic test with ID '{diagnostic_id}' not found.",
        )
    return {"status": "success", "message": f"Diagnostic test '{diagnostic_id}' deleted successfully."}


# =========================================================================
# 2. Diagnostic Booking & Lifecycle Endpoints
# =========================================================================

@router.post(
    "/bookings",
    response_model=DiagnosticBookingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new diagnostic test booking",
)
def create_booking(
    booking_in: DiagnosticBookingCreate,
    db: Session = Depends(get_sync_db),
):
    """Book a diagnostic test for a patient at an available facility."""
    if booking_in.id:
        existing = DiagnosticService.get_booking_by_id(db, booking_in.id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Diagnostic booking with ID '{booking_in.id}' already exists.",
            )

    try:
        booking = DiagnosticService.create_booking(db, booking_in)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    return _to_booking_response(booking, db=db)


@router.get(
    "/bookings/list",
    response_model=List[DiagnosticBookingResponse],
    summary="List diagnostic bookings with optional filters",
)
def list_bookings(
    facility_id: Optional[str] = Query(None, description="Filter by facility ID"),
    diagnostic_id: Optional[str] = Query(None, description="Filter by diagnostic test ID"),
    patient_id: Optional[str] = Query(None, description="Filter by patient ID"),
    booking_status: Optional[BookingStatus] = Query(None, alias="status", description="Filter by status"),
    result_status: Optional[ResultStatus] = Query(None, description="Filter by result availability status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_sync_db),
):
    """List diagnostic bookings with queue and status tracking."""
    bookings = DiagnosticService.get_bookings(
        db=db,
        facility_id=facility_id,
        diagnostic_id=diagnostic_id,
        patient_id=patient_id,
        status=booking_status,
        result_status=result_status,
        skip=skip,
        limit=limit,
    )
    return [_to_booking_response(b, db=db) for b in bookings]


@router.get(
    "/bookings/{booking_id}/queue-position",
    response_model=DiagnosticQueuePositionResponse,
    summary="Get real-time queue position for a booking",
)
def get_booking_queue_position(
    booking_id: str,
    db: Session = Depends(get_sync_db),
):
    """Retrieve calculated real-time queue position and estimated wait time."""
    q_pos_resp = DiagnosticService.get_booking_queue_position(db, booking_id)
    if not q_pos_resp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagnostic booking with ID '{booking_id}' not found.",
        )
    return q_pos_resp


@router.get(
    "/bookings/{booking_id}",
    response_model=DiagnosticBookingResponse,
    summary="Get single diagnostic booking details by ID",
)
def get_booking(
    booking_id: str,
    db: Session = Depends(get_sync_db),
):
    """Retrieve details for a specific diagnostic booking."""
    booking = DiagnosticService.get_booking_by_id(db, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagnostic booking with ID '{booking_id}' not found.",
        )
    return _to_booking_response(booking, db=db)


@router.patch(
    "/bookings/{booking_id}/status",
    response_model=DiagnosticBookingResponse,
    summary="Transition diagnostic booking lifecycle state (Protected)",
)
def update_booking_status(
    booking_id: str,
    status_update: DiagnosticBookingStatusUpdate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Update booking lifecycle status (REQUESTED -> BOOKED -> IN_PROGRESS -> COMPLETED / CANCELLED / FAILED).

    Enforces state machine transition rules.
    """
    try:
        updated = DiagnosticService.update_booking_status(
            db=db,
            booking_id=booking_id,
            new_status=status_update.status,
            notes=status_update.notes,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    return _to_booking_response(updated, db=db)


@router.patch(
    "/bookings/{booking_id}/result-status",
    response_model=DiagnosticBookingResponse,
    summary="Update diagnostic test result availability status (Protected)",
)
def update_result_status(
    booking_id: str,
    result_update: DiagnosticBookingResultStatusUpdate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Update result availability status (PENDING or AVAILABLE) independently of booking lifecycle state."""
    try:
        updated = DiagnosticService.update_result_status(
            db=db,
            booking_id=booking_id,
            result_status=result_update.result_status,
            notes=result_update.notes,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )

    return _to_booking_response(updated, db=db)
