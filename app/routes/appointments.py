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


# =========================================================
# HELPERS
# =========================================================

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


def appointment_datetime(appointment) -> datetime:
    return datetime.combine(
        appointment.appointment_date,
        appointment.appointment_time,
    )


async def _get_active_appointments_ordered(
    db: AsyncSession,
):
    """
    Return only appointments that are not cancelled
    and are scheduled for today or a future date.
    """

    today = date.today()

    result = await db.execute(
        select(Appointment)
        .where(
            Appointment.status != "CANCELLED",
            Appointment.appointment_date >= today,
        )
        .order_by(
            Appointment.appointment_date,
            Appointment.appointment_time,
            Appointment.appointment_id,
        )
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

    today = date.today()

    # -----------------------------------------------------
    # Reject past dates
    # -----------------------------------------------------

    if data.appointment_date < today:
        raise HTTPException(
            status_code=400,
            detail="Past dates cannot be selected.",
        )

    # -----------------------------------------------------
    # Reject past time if appointment is today
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # Validate purpose
    # -----------------------------------------------------

    purpose = data.purpose.strip()

    if not purpose:
        raise HTTPException(
            status_code=400,
            detail="Appointment purpose is required.",
        )

    # -----------------------------------------------------
    # Create token
    # -----------------------------------------------------

    token_id = str(uuid4())

    token = Token(
        token_id=token_id,
        user_id=current_user.user_id,
        queue_position=None,
        priority_type="NORMAL",
        token_status="WAITING",
    )

    # -----------------------------------------------------
    # Create appointment
    # -----------------------------------------------------

    appointment = Appointment(
        user_id=current_user.user_id,
        token_id=token_id,
        purpose=purpose,
        appointment_date=data.appointment_date,
        appointment_time=data.appointment_time,
        status="PENDING",
    )

    db.add(token)
    db.add(appointment)

    await db.commit()
    await db.refresh(appointment)

    # -----------------------------------------------------
    # Return appointment
    # -----------------------------------------------------

    token_number = token_display_for(
        appointment.appointment_id
    )

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
# GET MY APPOINTMENTS
# =========================================================

@router.get("")
async def get_my_appointments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(Appointment)
        .where(
            Appointment.user_id == current_user.user_id
        )
        .order_by(
            Appointment.appointment_date,
            Appointment.appointment_time,
            Appointment.appointment_id,
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
            "token_number": token_display_for(
                appointment.appointment_id
            ),
            "purpose": appointment.purpose,
            "appointment_date": appointment.appointment_date,
            "appointment_time": appointment.appointment_time,
            "counter": "Counter 1",
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

    now = datetime.now()

    # -----------------------------------------------------
    # No active appointments
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # Find appointments whose scheduled time has arrived
    # -----------------------------------------------------

    due_appointments = [
        appointment
        for appointment in active
        if appointment_datetime(appointment) <= now
    ]

    # -----------------------------------------------------
    # No appointment is due yet
    # -----------------------------------------------------

    if not due_appointments:

        currently_serving = None
        currently_serving_id = None
        current_index = -1
        remaining_current_service = 0

    else:

        first_appointment = due_appointments[0]

        reference_time = appointment_datetime(
            first_appointment
        )

        minutes_elapsed = max(
            0.0,
            (
                now - reference_time
            ).total_seconds() / 60,
        )

        tokens_advanced = int(
            minutes_elapsed // SERVICE_RATE_MINUTES
        )

        current_index = min(
            tokens_advanced,
            len(active) - 1,
        )

        currently_serving = active[current_index]

        currently_serving_id = (
            currently_serving.appointment_id
        )

        # -------------------------------------------------
        # Remaining time
        # -------------------------------------------------

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
                SERVICE_RATE_MINUTES
                - time_in_current_service,
            )

    # -----------------------------------------------------
    # Waiting appointments
    # -----------------------------------------------------

    if currently_serving_id is None:

        waiting_appointments = active

    else:

        waiting_appointments = [
            appointment
            for appointment in active
            if appointment.appointment_id
            > currently_serving_id
        ]

    queue_size = len(waiting_appointments)

    # -----------------------------------------------------
    # People currently present
    # -----------------------------------------------------

    if currently_serving is None:

        people_currently_present = queue_size

    else:

        people_currently_present = 1 + queue_size

    # -----------------------------------------------------
    # Current user's active appointment
    # -----------------------------------------------------

    my_appointments = [
        appointment
        for appointment in active
        if appointment.user_id == current_user.user_id
    ]

    you = None

    if my_appointments:

        my_appointment = max(
            my_appointments,
            key=lambda appointment:
                appointment.appointment_id,
        )

        my_id = my_appointment.appointment_id

        # -------------------------------------------------
        # Already served
        # -------------------------------------------------

        if (
            currently_serving_id is not None
            and my_id < currently_serving_id
        ):

            my_status = "SERVED"
            people_ahead = 0
            estimated_wait = 0

        # -------------------------------------------------
        # Being served
        # -------------------------------------------------

        elif (
            currently_serving_id is not None
            and my_id == currently_serving_id
        ):

            my_status = "BEING_SERVED"
            people_ahead = 0
            estimated_wait = 0

        # -------------------------------------------------
        # Waiting
        # -------------------------------------------------

        else:

            my_status = "WAITING"

            if currently_serving_id is None:

                people_ahead = len([
                    appointment
                    for appointment in active
                    if appointment.appointment_id < my_id
                ])

                estimated_wait = (
                    people_ahead
                    * SERVICE_RATE_MINUTES
                )

            else:

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

        # -------------------------------------------------
        # Position
        # -------------------------------------------------

        position = next(
            (
                index + 1
                for index, appointment
                in enumerate(active)
                if appointment.appointment_id == my_id
            ),
            None,
        )

        you = {
            "appointment_id":
                my_appointment.appointment_id,

            "token_display":
                token_display_for(
                    my_appointment.appointment_id
                ),

            "token_number":
                token_display_for(
                    my_appointment.appointment_id
                ),

            "purpose":
                my_appointment.purpose,

            "appointment_date":
                my_appointment.appointment_date,

            "appointment_time":
                my_appointment.appointment_time,

            "position":
                position,

            "people_ahead":
                people_ahead,

            "estimated_wait_minutes":
                estimated_wait,

            "status":
                my_status,
        }

    # -----------------------------------------------------
    # Global wait time
    # -----------------------------------------------------

    if currently_serving is None:

        estimated_wait_minutes = round(
            queue_size
            * SERVICE_RATE_MINUTES,
            1,
        )

    elif queue_size == 0:

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

    # -----------------------------------------------------
    # Crowd level
    # -----------------------------------------------------

    crowd_level = crowd_level_for(
        queue_size
    )

    # -----------------------------------------------------
    # Return live queue
    # -----------------------------------------------------

    return {
        "server_time":
            now.isoformat(),

        "total_active":
            len(active),

        "served_so_far":
            max(current_index, 0),

        "queue_size":
            queue_size,

        "people_currently_present":
            people_currently_present,

        "estimated_wait_minutes":
            estimated_wait_minutes,

        "currently_serving_token":
            (
                token_display_for(
                    currently_serving_id
                )
                if currently_serving_id is not None
                else None
            ),

        "remaining_current_service_minutes":
            round(
                remaining_current_service,
                1,
            ),

        "crowd_level":
            crowd_level,

        "service_rate_minutes":
            SERVICE_RATE_MINUTES,

        "low_crowd_max":
            LOW_CROWD_MAX,

        "moderate_crowd_max":
            MODERATE_CROWD_MAX,

        "you":
            you,
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

    token_number = token_display_for(
        appointment.appointment_id
    )

    return {
        "appointment_id":
            appointment.appointment_id,

        "user_id":
            appointment.user_id,

        "token_id":
            appointment.token_id,

        "token_display":
            token_number,

        "token_number":
            token_number,

        "purpose":
            appointment.purpose,

        "appointment_date":
            appointment.appointment_date,

        "appointment_time":
            appointment.appointment_time,

        "counter":
            "Counter 1",

        "status":
            appointment.status,
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

    # Already cancelled

    if (
        str(appointment.status).upper()
        == "CANCELLED"
    ):

        return {
            "message":
                "Appointment already cancelled",

            "appointment_id":
                appointment.appointment_id,

            "status":
                "CANCELLED",
        }

    # -----------------------------------------------------
    # Cancel appointment
    # -----------------------------------------------------

    appointment.status = "CANCELLED"

    # -----------------------------------------------------
    # Cancel associated token
    # -----------------------------------------------------

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
        "message":
            "Appointment cancelled successfully",

        "appointment_id":
            appointment.appointment_id,

        "status":
            "CANCELLED",
    }