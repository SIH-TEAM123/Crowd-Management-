from datetime import date, datetime, time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.appointment import Appointment
from app.models.token import Token
from app.models.user import User
from app.utils.auth import get_current_user


router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"],
)


# =========================================================
# Shared "single source of truth" queue simulation config.
#
# There is one global, always-consistent queue derived from
# real appointment rows: every non-cancelled appointment gets
# a sequential display token (based on its global, ever
# increasing appointment_id), and the "currently serving"
# token advances automatically over real time. Every page in
# the frontend (dashboard, queue, crowd status, profile,
# notifications, reports, analytics) reads this same endpoint
# so the numbers always match everywhere and change live.
# =========================================================

TOKEN_PREFIX = "A"
TOKEN_BASE = 100  # first appointment_id (1) -> token A-101

# Average minutes it takes to fully serve one token/appointment.
SERVICE_RATE_MINUTES = 4

# Crowd level thresholds, based on how many people are
# still waiting in the live queue right now.
LOW_CROWD_MAX = 5
MODERATE_CROWD_MAX = 15


def token_display_for(appointment_id: int) -> str:
    return f"{TOKEN_PREFIX}-{TOKEN_BASE + appointment_id}"


def crowd_level_for(queue_size: int) -> str:
    if queue_size <= 0:
        return "No Crowd"
    if queue_size <= LOW_CROWD_MAX:
        return "Low"
    if queue_size <= MODERATE_CROWD_MAX:
        return "Moderate"
    return "High"


async def _get_active_appointments_ordered(db: AsyncSession):
    """All non-cancelled appointments, oldest first -> this *is* the queue."""
    result = await db.execute(
        select(Appointment)
        .where(Appointment.status != "CANCELLED")
        .order_by(Appointment.appointment_id)
    )
    return result.scalars().all()


class AppointmentCreate(BaseModel):
    purpose: str
    appointment_date: date
    appointment_time: time


@router.post("")
async def create_appointment(
    data: AppointmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token_id = str(uuid4())

    token = Token(
        token_id=token_id,
        user_id=current_user.user_id,
        queue_position=None,
        priority_type="NORMAL",
        token_status="WAITING",
    )

    appointment = Appointment(
        user_id=current_user.user_id,
        token_id=token_id,
        purpose=data.purpose,
        appointment_date=data.appointment_date,
        appointment_time=data.appointment_time,
        status="PENDING",
    )

    db.add(token)
    db.add(appointment)

    await db.commit()
    await db.refresh(appointment)

    return {
        "appointment_id": appointment.appointment_id,
        "user_id": appointment.user_id,
        "token_id": appointment.token_id,
        "token_display": token_display_for(appointment.appointment_id),
        "purpose": appointment.purpose,
        "appointment_date": appointment.appointment_date,
        "appointment_time": appointment.appointment_time,
        "status": appointment.status,
    }


@router.get("")
async def get_my_appointments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment)
        .where(Appointment.user_id == current_user.user_id)
        .order_by(Appointment.appointment_date, Appointment.appointment_time)
    )

    appointments = result.scalars().all()

    return [
        {
            "appointment_id": appointment.appointment_id,
            "user_id": appointment.user_id,
            "token_id": appointment.token_id,
            "token_display": token_display_for(appointment.appointment_id),
            "purpose": appointment.purpose,
            "appointment_date": appointment.appointment_date,
            "appointment_time": appointment.appointment_time,
            "status": appointment.status,
        }
        for appointment in appointments
    ]


@router.get("/queue/status")
async def get_queue_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Single source of truth for queue / crowd numbers, shared by
    every page (dashboard, queue, crowd status, profile,
    notifications, reports, analytics).

    The queue is built entirely from real appointment rows
    (global across all users) and advances automatically with
    real time, so refreshing any page - or opening a second
    tab/user - always shows the exact same, live-updating state.
    """

    active = await _get_active_appointments_ordered(db)
    total_active = len(active)

    if total_active == 0:
        reference_time = datetime.utcnow()
    else:
        reference_time = min(a.created_at for a in active)

    minutes_elapsed = max(
        0.0,
        (datetime.utcnow() - reference_time).total_seconds() / 60,
    )

    served_so_far = min(
        total_active,
        int(minutes_elapsed // SERVICE_RATE_MINUTES),
    )

    currently_serving = active[served_so_far - 1] if served_so_far > 0 else None
    queue_size = max(0, total_active - served_so_far)

    my_active = [a for a in active if a.user_id == current_user.user_id]

    you = None
    if my_active:
        my_appointment = my_active[0]
        position = active.index(my_appointment)  # 0-indexed
        people_ahead = max(0, position - served_so_far)

        if position < served_so_far:
            my_status = "SERVED"
        elif position == served_so_far:
            my_status = "BEING_SERVED"
        else:
            my_status = "WAITING"

        you = {
            "appointment_id": my_appointment.appointment_id,
            "token_display": token_display_for(my_appointment.appointment_id),
            "purpose": my_appointment.purpose,
            "appointment_date": my_appointment.appointment_date,
            "appointment_time": my_appointment.appointment_time,
            "position": position + 1,
            "people_ahead": people_ahead,
            "estimated_wait_minutes": people_ahead * SERVICE_RATE_MINUTES,
            "status": my_status,
        }

    return {
        "server_time": datetime.utcnow().isoformat(),
        "total_active": total_active,
        "served_so_far": served_so_far,
        "queue_size": queue_size,
        "estimated_wait_minutes": queue_size * SERVICE_RATE_MINUTES,
        "currently_serving_token": (
            token_display_for(currently_serving.appointment_id)
            if currently_serving
            else None
        ),
        "crowd_level": crowd_level_for(queue_size),
        "service_rate_minutes": SERVICE_RATE_MINUTES,
        "low_crowd_max": LOW_CROWD_MAX,
        "moderate_crowd_max": MODERATE_CROWD_MAX,
        "you": you,
    }


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

    return {
        "appointment_id": appointment.appointment_id,
        "user_id": appointment.user_id,
        "token_id": appointment.token_id,
        "token_display": token_display_for(appointment.appointment_id),
        "purpose": appointment.purpose,
        "appointment_date": appointment.appointment_date,
        "appointment_time": appointment.appointment_time,
        "status": appointment.status,
    }


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
        "status": appointment.status,
    }