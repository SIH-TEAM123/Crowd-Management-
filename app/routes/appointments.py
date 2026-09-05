from datetime import date, datetime, time
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.appointment import Appointment
from app.models.token import Token
from app.models.user import User
from app.services.queue_engine import (
    queue_engine,
    TOKEN_START,
    SERVICE_RATE_MINUTES,
    CROWD_LOW_MAX,
    CROWD_MODERATE_MAX,
    CROWD_HIGH_MAX,
)
from app.services.qr_service import generate_qr_svg, create_token_qr_payload
from app.utils.auth import get_current_user, get_current_user_optional


router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"],
)


# =========================================================

# =========================================================
# COMPATIBILITY HELPERS
# =========================================================

def token_display_for(appointment_id: int) -> str:
    """Exported helper for backwards-compatibility (starts strictly at 114)"""
    return queue_engine.token_display_for(appointment_id)

# SCHEMAS
# =========================================================

class AppointmentCreate(BaseModel):
    purpose: str
    appointment_date: date
    appointment_time: time
    facility_id: Optional[str] = None
    priority_type: Optional[str] = "NORMAL"  # NORMAL, VULNERABLE, TIME_CRITICAL, EMERGENCY


class SimulationRequest(BaseModel):
    num_users: int = 50
    service_rate_minutes: float = 4.0


# =========================================================
# CREATE APPOINTMENT
# =========================================================

@router.post("")
@router.post("/")
async def create_appointment(
    data: AppointmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()

    # Reject past dates
    if data.appointment_date < today:
        raise HTTPException(
            status_code=400,
            detail="Past dates cannot be selected.",
        )

    # Reject past time if appointment is today
    if data.appointment_date == today:
        now = datetime.now()
        selected_datetime = datetime.combine(
            data.appointment_date,
            data.appointment_time,
        )
        if selected_datetime < now:
            raise HTTPException(
                status_code=400,
                detail="Appointment time cannot be in the past.",
            )

    # Validate purpose
    purpose = data.purpose.strip()
    if not purpose:
        raise HTTPException(
            status_code=400,
            detail="Appointment purpose is required.",
        )

    # Normalize priority
    priority_type = (data.priority_type or "NORMAL").upper()
    if priority_type not in ("NORMAL", "VULNERABLE", "TIME_CRITICAL", "EMERGENCY"):
        priority_type = "NORMAL"

    token_id = str(uuid4())

    token = Token(
        token_id=token_id,
        user_id=current_user.user_id,
        queue_position=None,
        priority_type=priority_type,
        token_status="WAITING",
    )

    appointment = Appointment(
        user_id=current_user.user_id,
        token_id=token_id,
        purpose=purpose,
        appointment_date=data.appointment_date,
        appointment_time=data.appointment_time,
        facility_id=data.facility_id,
        status="PENDING",
    )

    db.add(token)
    db.add(appointment)

    await db.commit()
    await db.refresh(appointment)

    # Calculate token starting from 114
    token_display = queue_engine.token_display_for(appointment.appointment_id)
    token_number = queue_engine.token_number_for(appointment.appointment_id)

    # Update token record queue_position to store the integer token
    token.queue_position = token_number
    await db.commit()

    return {
        "appointment_id": appointment.appointment_id,
        "user_id": appointment.user_id,
        "token_id": appointment.token_id,
        "token_display": token_display,
        "token_number": token_display,
        "token_numeric": token_number,
        "purpose": appointment.purpose,
        "appointment_date": appointment.appointment_date,
        "appointment_time": appointment.appointment_time,
        "counter": f"Counter {((token_number - queue_engine.TOKEN_START) % 4) + 1}",
        "status": appointment.status,
        "priority_type": priority_type,
    }


# =========================================================
# GET MY APPOINTMENTS
# =========================================================

@router.get("")
@router.get("/")
async def get_my_appointments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(Appointment)
            .where(Appointment.user_id == current_user.user_id)
            .order_by(
                Appointment.appointment_date,
                Appointment.appointment_time,
                Appointment.appointment_id,
            )
        )
        appointments = result.scalars().all()

        # Load tokens to include priority safely
        token_ids = [a.token_id for a in appointments if a.token_id]
        if token_ids:
            t_result = await db.execute(
                select(Token).where(Token.token_id.in_(token_ids))
            )
            token_map = {t.token_id: t for t in t_result.scalars().all()}
        else:
            token_map = {}

        return [
            {
                "appointment_id": appt.appointment_id,
                "user_id": appt.user_id,
                "token_id": appt.token_id,
                "token_display": queue_engine.token_display_for(appt.appointment_id),
                "token_number": queue_engine.token_display_for(appt.appointment_id),
                "token_numeric": queue_engine.token_number_for(appt.appointment_id),
                "purpose": appt.purpose,
                "appointment_date": appt.appointment_date,
                "appointment_time": appt.appointment_time,
                "counter": "Counter 1",
                "status": appt.status,
                "priority_type": getattr(token_map.get(appt.token_id), "priority_type", "NORMAL") or "NORMAL",
            }
            for appt in appointments
        ]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Database error loading appointments: {str(e)}"
        )



# =========================================================
# LIVE QUEUE STATUS (Single Source of Truth)
# =========================================================

@router.get("/queue/status")
async def get_queue_status(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Authoritative queue status returned by the Unified Queue Engine.
    All frontend tabs (Dashboard, Queue, Crowd, Forecast, Notifications, Reports, Arcade)
    consume this identical data source.
    """
    return await queue_engine.get_queue_status(db, current_user)


# =========================================================
# BACKEND SIMULATION CONTROL (Unified Queue Engine)
# =========================================================

@router.post("/queue/simulate")
async def start_queue_simulation(
    request: SimulationRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Start synthetic crowd simulation through the authoritative Queue Engine.
    Uses the same queue and token numbering as real appointments.
    """
    result = queue_engine.start_simulation(
        num_users=request.num_users,
        service_rate_minutes=request.service_rate_minutes,
    )
    return {
        "success": True,
        "message": f"Simulation active with {result['synthetic_users']} people ahead.",
        **result,
    }


@router.post("/queue/simulation/reset")
async def reset_queue_simulation(
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Reset backend simulation and restore pure live queue state.
    """
    result = queue_engine.reset_simulation()
    return {
        "success": True,
        **result,
    }


# =========================================================
# QR PASS GENERATION
# =========================================================

@router.get("/{appointment_id}/qr")
async def get_appointment_qr(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.appointment_id == appointment_id,
            Appointment.user_id == current_user.user_id,
        )
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    token_display = queue_engine.token_display_for(appointment.appointment_id)
    payload = create_token_qr_payload(
        appointment_id=appointment.appointment_id,
        token_display=token_display,
        user_id=current_user.user_id,
        facility_id=appointment.facility_id or "MAIN",
    )
    svg = generate_qr_svg(payload, size=240)

    return {
        "appointment_id": appointment.appointment_id,
        "token_display": token_display,
        "token_number": token_display,
        "qr_payload": payload,
        "qr_svg": svg,
    }


@router.get("/{appointment_id}/qr/svg")
async def get_appointment_qr_svg_image(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.appointment_id == appointment_id,
            Appointment.user_id == current_user.user_id,
        )
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    token_display = queue_engine.token_display_for(appointment.appointment_id)
    payload = create_token_qr_payload(
        appointment_id=appointment.appointment_id,
        token_display=token_display,
        user_id=current_user.user_id,
        facility_id=appointment.facility_id or "MAIN",
    )
    svg = generate_qr_svg(payload, size=240)
    return Response(content=svg, media_type="image/svg+xml")


# =========================================================
# GET SINGLE APPOINTMENT
# =========================================================

@router.get("/{appointment_id}")
async def get_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.appointment_id == appointment_id,
            Appointment.user_id == current_user.user_id,
        )
    )
    appointment = result.scalar_one_or_none()
    if appointment is None:
        raise HTTPException(
            status_code=404,
            detail="Appointment not found",
        )

    token_number = queue_engine.token_display_for(appointment.appointment_id)

    return {
        "appointment_id": appointment.appointment_id,
        "user_id": appointment.user_id,
        "token_id": appointment.token_id,
        "token_display": token_number,
        "token_number": token_number,
        "purpose": appointment.purpose,
        "appointment_date": appointment.appointment_date,
        "appointment_time": appointment.appointment_time,
        "counter": "Counter 1",
        "status": appointment.status,
    }


# =========================================================
# CANCEL APPOINTMENT
# =========================================================

@router.delete("/{appointment_id}")
async def cancel_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.appointment_id == appointment_id,
            Appointment.user_id == current_user.user_id,
        )
    )
    appointment = result.scalar_one_or_none()

    if appointment is None:
        raise HTTPException(
            status_code=404,
            detail="Appointment not found",
        )

    if str(appointment.status).upper() == "CANCELLED":
        return {
            "message": "Appointment already cancelled",
            "appointment_id": appointment.appointment_id,
            "status": "CANCELLED",
        }

    appointment.status = "CANCELLED"

    token_result = await db.execute(
        select(Token).where(Token.token_id == appointment.token_id)
    )
    token = token_result.scalar_one_or_none()
    if token is not None:
        token.token_status = "CANCELLED"

    await db.commit()

    return {
        "message": "Appointment cancelled successfully",
        "appointment_id": appointment.appointment_id,
        "status": "CANCELLED",
    }
