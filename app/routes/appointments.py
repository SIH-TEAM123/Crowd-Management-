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
# QUEUE CONFIGURATION
# =========================================================

TOKEN_PREFIX = "A"
TOKEN_BASE = 100

SERVICE_RATE_MINUTES = 4

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


# =========================================================
# CREATE APPOINTMENT
# =========================================================

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
        "token_display": token_display_for(
            appointment.appointment_id
        ),
        "purpose": appointment.purpose,
        "appointment_date": appointment.appointment_date,
        "appointment_time": appointment.appointment_time,
        "status": appointment.status,
    }


# =========================================================
# GET MY APPOINTMENTS
# =========================================================

@router.get("")
async def get_my_appointments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment)
        .where(Appointment.user_id == current_user.user_id)
        .order_by(
            Appointment.appointment_date,
            Appointment.appointment_time,
        )
    )

    appointments = result.scalars().all()

    return [
        {
            "appointment_id": appointment.appointment_id,
            "user_id": appointment.user_id,
            "token_id": appointment.token_id,
            "token_display": token_display_for(
                appointment.appointment_id
            ),
            "purpose": appointment.purpose,
            "appointment_date": appointment.appointment_date,
            "appointment_time": appointment.appointment_time,
            "status": appointment.status,
        }
        for appointment in appointments
    ]


# =========================================================
# LIVE QUEUE STATUS
# =========================================================

@router.get("/queue/status")
async def get_queue_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    active = await _get_active_appointments_ordered(db)

    now = datetime.utcnow()

    # No active appointments
    if not active:
        return {
            "server_time": now.isoformat(),
            "total_active": 0,
            "served_so_far": 0,
            "queue_size": 0,
            "people_currently_present": 0,
            "estimated_wait_minutes": 0,
            "currently_serving_token": None,
            "remaining_current_service_minutes": 0,
            "crowd_level": "No Crowd",
            "service_rate_minutes": SERVICE_RATE_MINUTES,
            "low_crowd_max": LOW_CROWD_MAX,
            "moderate_crowd_max": MODERATE_CROWD_MAX,
            "you": None,
        }

    # First appointment starts the queue
    first_appointment = active[0]
    reference_time = first_appointment.created_at

    minutes_elapsed = max(
        0.0,
        (now - reference_time).total_seconds() / 60,
    )

    tokens_advanced = int(
        minutes_elapsed // SERVICE_RATE_MINUTES
    )

    current_index = min(
        tokens_advanced,
        len(active) - 1,
    )

    currently_serving = active[current_index]
    currently_serving_id = currently_serving.appointment_id

    # Remaining time for current service
    if (
        current_index >= len(active) - 1
        and tokens_advanced >= len(active)
    ):
        remaining_current_service = 0
    else:
        time_in_current_service = (
            minutes_elapsed % SERVICE_RATE_MINUTES
        )

        remaining_current_service = max(
            0,
            SERVICE_RATE_MINUTES - time_in_current_service,
        )

    # People waiting after currently serving
    waiting_appointments = [
        appointment
        for appointment in active
        if appointment.appointment_id > currently_serving_id
    ]

    queue_size = len(waiting_appointments)

    # Current person being served + waiting people
    people_currently_present = 1 + queue_size

    # Current user's latest active appointment
    my_appointments = [
        appointment
        for appointment in active
        if appointment.user_id == current_user.user_id
    ]

    you = None

    if my_appointments:
        my_appointment = max(
            my_appointments,
            key=lambda appointment: appointment.appointment_id,
        )

        my_id = my_appointment.appointment_id

        if my_id < currently_serving_id:
            my_status = "SERVED"
            people_ahead = 0
            estimated_wait = 0

        elif my_id == currently_serving_id:
            my_status = "BEING_SERVED"
            people_ahead = 0
            estimated_wait = 0

        else:
            my_status = "WAITING"

            people_ahead = len([
                appointment
                for appointment in active
                if (
                    currently_serving_id
                    < appointment.appointment_id
                    < my_id
                )
            ])

            estimated_wait = (
                remaining_current_service
                + (
                    people_ahead
                    * SERVICE_RATE_MINUTES
                )
            )

            estimated_wait = round(
                estimated_wait,
                1,
            )

        you = {
            "appointment_id": my_appointment.appointment_id,
            "token_display": token_display_for(
                my_appointment.appointment_id
            ),
            "purpose": my_appointment.purpose,
            "appointment_date": my_appointment.appointment_date,
            "appointment_time": my_appointment.appointment_time,
            "position": active.index(my_appointment) + 1,
            "people_ahead": people_ahead,
            "estimated_wait_minutes": estimated_wait,
            "status": my_status,
        }

    # Global queue wait
    if queue_size == 0:
        estimated_wait_minutes = 0
    else:
        estimated_wait_minutes = round(
            remaining_current_service
            + (
                max(queue_size - 1, 0)
                * SERVICE_RATE_MINUTES
            ),
            1,
        )

    crowd_level = crowd_level_for(queue_size)

    return {
        "server_time": now.isoformat(),
        "total_active": len(active),
        "served_so_far": current_index,
        "queue_size": queue_size,
        "people_currently_present": people_currently_present,
        "estimated_wait_minutes": estimated_wait_minutes,
        "currently_serving_token": token_display_for(
            currently_serving_id
        ),
        "remaining_current_service_minutes": round(
            remaining_current_service,
            1,
        ),
        "crowd_level": crowd_level,
        "service_rate_minutes": SERVICE_RATE_MINUTES,
        "low_crowd_max": LOW_CROWD_MAX,
        "moderate_crowd_max": MODERATE_CROWD_MAX,
        "you": you,
    }


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

    return {
        "appointment_id": appointment.appointment_id,
        "user_id": appointment.user_id,
        "token_id": appointment.token_id,
        "token_display": token_display_for(
            appointment.appointment_id
        ),
        "purpose": appointment.purpose,
        "appointment_date": appointment.appointment_date,
        "appointment_time": appointment.appointment_time,
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

    appointment.status = "CANCELLED"

    token_result = await db.execute(
        select(Token).where(
            Token.token_id == appointment.token_id
        )
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