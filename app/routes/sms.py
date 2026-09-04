"""FastAPI route handlers for SMS notification audit and token dispatch."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import require_admin_or_operator
from app.database import get_db
from app.schemas.sms import (
    SMSDeliveryRecordResponse,
    SMSSendRequest,
    SMSTokenResponse,
)
from app.services.sms_service import SMSService

router = APIRouter(prefix="/sms", tags=["SMS Token Notifications"])


@router.post(
    "/send-token/{appointment_id}",
    response_model=SMSTokenResponse,
    summary="Dispatch token SMS notification (Protected)",
)
def send_token_sms_direct(
    appointment_id: str,
    sms_req: Optional[SMSSendRequest] = None,
    db: Session = Depends(get_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Direct alias endpoint to trigger authoritative token SMS."""
    try:
        phone = sms_req.phone_number if sms_req else None
        _, resp = SMSService.send_token_sms(db, appointment_id=appointment_id, phone_number=phone)
        return resp
    except ValueError as err:
        err_msg = str(err)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)


@router.get(
    "/history/{appointment_id}",
    response_model=List[SMSDeliveryRecordResponse],
    summary="Get SMS delivery audit trail for an appointment (Protected)",
)
def get_sms_history(
    appointment_id: str,
    db: Session = Depends(get_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Retrieve audit records of SMS messages dispatched for an appointment."""
    return SMSService.get_appointment_sms_records(db, appointment_id)
