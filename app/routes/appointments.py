"""FastAPI route handlers for Patient Appointments, Queue Tokens, and OPD Queue Tracking."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_admin_or_operator
from app.database import get_db
from app.models.appointment import AppointmentStatus
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatusUpdate,
    FacilityQueueSummary,
)
from app.schemas.sms import (
    SMSDeliveryRecordResponse,
    SMSSendRequest,
    SMSTokenResponse,
)
from app.services.appointment_service import AppointmentService
from app.services.facility_service import FacilityService
from app.services.sms_service import SMSService

router = APIRouter(tags=["Appointments & OPD Queue"])


def _to_appointment_response(apt) -> AppointmentResponse:
    latest_sms = None
    if hasattr(apt, "sms_records") and apt.sms_records:
        latest_sms = apt.sms_records[-1].status.value

    return AppointmentResponse(
        id=apt.id,
        facility_id=apt.facility_id,
        patient_id=apt.patient_id,
        patient_name=apt.patient_name,
        phone_number=apt.phone_number,
        specialist_id=apt.specialist_id,
        token_number=apt.token_number,
        status=apt.status,
        department=apt.department,
        slot_start_time=apt.slot_start_time,
        slot_end_time=apt.slot_end_time,
        appointment_date=apt.appointment_date,
        check_in_time=apt.check_in_time,
        consultation_start_time=apt.consultation_start_time,
        completed_time=apt.completed_time,
        notes=apt.notes,
        created_at=apt.created_at,
        updated_at=apt.updated_at,
        facility_name=apt.facility.name if apt.facility else None,
        specialist_name=apt.specialist.name if apt.specialist else None,
        sms_status=latest_sms,
    )


@router.post(
    "/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book a patient appointment and generate queue token",
)
def create_appointment(
    apt_in: AppointmentCreate,
    db: Session = Depends(get_db),
):
    """Register patient appointment and assign sequential queue token."""
    try:
        apt = AppointmentService.create_appointment(db, apt_in)
    except ValueError as err:
        err_msg = str(err)
        if "already booked" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=err_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )
    return _to_appointment_response(apt)


@router.get(
    "/appointments",
    response_model=List[AppointmentResponse],
    summary="List appointments and queue tokens with optional filters",
)
def list_appointments(
    facility_id: Optional[str] = Query(None, description="Filter by facility ID"),
    patient_id: Optional[str] = Query(None, description="Filter by patient ID"),
    specialist_id: Optional[str] = Query(None, description="Filter by specialist ID"),
    apt_status: Optional[AppointmentStatus] = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Retrieve appointments and queue tokens."""
    records = AppointmentService.get_appointments(
        db=db,
        facility_id=facility_id,
        patient_id=patient_id,
        specialist_id=specialist_id,
        status=apt_status,
        skip=skip,
        limit=limit,
    )
    return [_to_appointment_response(a) for a in records]


@router.get(
    "/appointments/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Get appointment and token details by ID",
)
def get_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve details for a single appointment."""
    apt = AppointmentService.get_appointment_by_id(db, appointment_id)
    if not apt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Appointment with ID '{appointment_id}' not found.",
        )
    return _to_appointment_response(apt)


@router.patch(
    "/appointments/{appointment_id}/status",
    response_model=AppointmentResponse,
    summary="Advance appointment status (Check-in, Consult, Complete) (Protected)",
)
def update_appointment_status(
    appointment_id: str,
    status_update: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Advance appointment queue lifecycle."""
    try:
        updated = AppointmentService.update_appointment_status(
            db=db,
            appointment_id=appointment_id,
            new_status=status_update.status,
            notes=status_update.notes,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )
    return _to_appointment_response(updated)


@router.get(
    "/facilities/{facility_id}/queue",
    response_model=FacilityQueueSummary,
    summary="Get live appointment queue metrics for a facility",
)
def get_facility_queue(
    facility_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve active appointment queue length, current serving count, and estimated wait."""
    fac = FacilityService.get_facility_by_id(db, facility_id)
    if not fac:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility with ID '{facility_id}' not found.",
        )
    return AppointmentService.get_facility_queue_metrics(db, facility_id)


@router.post(
    "/appointments/{appointment_id}/sms",
    response_model=SMSTokenResponse,
    summary="Trigger or resend authoritative token SMS (Protected)",
)
def send_appointment_token_sms(
    appointment_id: str,
    sms_req: Optional[SMSSendRequest] = None,
    db: Session = Depends(get_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Dispatch or resend official appointment token SMS to patient."""
    try:
        phone = sms_req.phone_number if sms_req else None
        _, response = SMSService.send_token_sms(db, appointment_id=appointment_id, phone_number=phone)
        return response
    except ValueError as err:
        err_msg = str(err)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)


@router.get(
    "/appointments/{appointment_id}/sms",
    response_model=List[SMSDeliveryRecordResponse],
    summary="Get SMS delivery audit trail for an appointment (Protected)",
)
def get_appointment_sms_history(
    appointment_id: str,
    db: Session = Depends(get_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Retrieve audit history of SMS deliveries for this appointment."""
    apt = AppointmentService.get_appointment_by_id(db, appointment_id)
    if not apt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Appointment with ID '{appointment_id}' not found.",
        )
    return SMSService.get_appointment_sms_records(db, appointment_id)
