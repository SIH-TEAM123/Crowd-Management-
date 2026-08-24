# ============================================================
# APPOINTMENTS ROUTES
# ============================================================

from datetime import date, time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.appointment import Appointment
from app.models.token import Token
from app.utils.auth import get_current_user


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"],
)


# ============================================================
# SCHEMAS
# ============================================================

class AppointmentCreate(BaseModel):
    purpose: str
    appointment_date: date
    appointment_time: time


# ============================================================
# TOKEN DISPLAY
# ============================================================

def display_token(appointment_id: int) -> str:
    return f"A-{appointment_id:03d}"


# ============================================================
# EXPIRE OLD APPOINTMENTS
# ============================================================

async def expire_old_appointments(
    db: AsyncSession
):
    today = date.today()

    result = await db.execute(
        select(Appointment, Token)
        .join(
            Token,
            Appointment.token_id == Token.token_id
        )
        .where(
            Appointment.appointment_date < today,
            Appointment.status == "PENDING",
        )
    )

    rows = result.all()

    changed = False

    for appointment, token in rows:

        appointment.status = "EXPIRED"
        token.token_status = "EXPIRED"
        token.queue_position = None

        changed = True

    if changed:
        await db.commit()


# ============================================================
# NORMALIZE QUEUE
#
# ONE SINGLE SOURCE OF TRUTH:
#
# Position 1 = SERVING
# Position 2+ = WAITING
#
# This function is called before dashboard, queue,
# appointments and after changes.
# ============================================================

async def update_currently_serving(
    db: AsyncSession
):
    today = date.today()

    result = await db.execute(
        select(Appointment, Token)
        .join(
            Token,
            Appointment.token_id == Token.token_id
        )
        .where(
            Appointment.appointment_date == today,
            Appointment.status == "PENDING",
            Token.token_status.in_([
                "WAITING",
                "SERVING",
            ]),
        )
        .order_by(
            Token.queue_position.asc(),
            Appointment.appointment_id.asc()
        )
    )

    rows = result.all()

    if not rows:
        return

    changed = False

    for index, (appointment, token) in enumerate(rows):

        new_position = index + 1
        new_status = (
            "SERVING"
            if index == 0
            else "WAITING"
        )

        if token.queue_position != new_position:
            token.queue_position = new_position
            changed = True

        if token.token_status != new_status:
            token.token_status = new_status
            changed = True

    if changed:
        await db.commit()


# ============================================================
# GET ALL ACTIVE QUEUE DATA
#
# This is the shared calculation used by dashboard.
# ============================================================

async def get_live_queue_data(
    db: AsyncSession,
    current_user_id: str | None = None,
):
    await expire_old_appointments(db)
    await update_currently_serving(db)

    today = date.today()

    # --------------------------------------------------------
    # GET ACTIVE QUEUE
    # --------------------------------------------------------

    result = await db.execute(
        select(Appointment, Token)
        .join(
            Token,
            Appointment.token_id == Token.token_id
        )
        .where(
            Appointment.appointment_date == today,
            Appointment.status == "PENDING",
            Token.token_status.in_([
                "WAITING",
                "SERVING",
            ]),
        )
        .order_by(
            Token.queue_position.asc()
        )
    )

    active_rows = result.all()

    # --------------------------------------------------------
    # SERVING TOKEN
    # --------------------------------------------------------

    serving_appointment = None
    serving_token = None

    for appointment, token in active_rows:
        if token.token_status == "SERVING":
            serving_appointment = appointment
            serving_token = token
            break

    # --------------------------------------------------------
    # CURRENT USER TOKEN
    # --------------------------------------------------------

    user_appointment = None
    user_token = None

    if current_user_id:

        for appointment, token in active_rows:

            if appointment.user_id == current_user_id:

                user_appointment = appointment
                user_token = token
                break

    # --------------------------------------------------------
    # CURRENT QUEUE
    #
    # WAITING ONLY
    # SERVING PERSON IS NOT "WAITING"
    # --------------------------------------------------------

    current_queue = sum(
        1
        for _, token in active_rows
        if token.token_status == "WAITING"
    )

    # --------------------------------------------------------
    # ACTIVE APPOINTMENTS
    #
    # Serving + Waiting
    # --------------------------------------------------------

    active_appointments = len(active_rows)

    # --------------------------------------------------------
    # TODAY APPOINTMENTS FOR CURRENT USER
    # --------------------------------------------------------

    today_appointments = 0

    if current_user_id:

        today_result = await db.execute(
            select(
                func.count(
                    Appointment.appointment_id
                )
            )
            .where(
                Appointment.user_id == current_user_id,
                Appointment.appointment_date == today,
            )
        )

        today_appointments = (
            today_result.scalar() or 0
        )

    # --------------------------------------------------------
    # SYSTEM TOTAL TODAY
    # --------------------------------------------------------

    total_today_result = await db.execute(
        select(
            func.count(
                Appointment.appointment_id
            )
        )
        .where(
            Appointment.appointment_date == today
        )
    )

    system_today_appointments = (
        total_today_result.scalar() or 0
    )

    # --------------------------------------------------------
    # DISPLAY CURRENTLY SERVING
    # --------------------------------------------------------

    currently_serving = None

    if serving_appointment:
        currently_serving = display_token(
            serving_appointment.appointment_id
        )

    # --------------------------------------------------------
    # DISPLAY USER TOKEN
    # --------------------------------------------------------

    your_token = None

    if user_appointment:
        your_token = display_token(
            user_appointment.appointment_id
        )

    # --------------------------------------------------------
    # PEOPLE AHEAD
    #
    # Count active tokens with lower queue position.
    #
    # Serving user = 0 ahead.
    # --------------------------------------------------------

    people_ahead = 0

    if (
        user_token
        and user_token.token_status == "WAITING"
        and user_token.queue_position is not None
    ):

        people_ahead = sum(
            1
            for _, token in active_rows
            if (
                token.queue_position is not None
                and token.queue_position
                < user_token.queue_position
            )
        )

    # --------------------------------------------------------
    # ESTIMATED WAIT
    #
    # 3 minutes per person ahead
    # --------------------------------------------------------

    estimated_wait_minutes = (
        people_ahead * 3
    )

    # --------------------------------------------------------
    # CROWD LEVEL
    # --------------------------------------------------------

    crowd_count = active_appointments

    if crowd_count == 0:
        crowd_level = "No Crowd"

    elif crowd_count <= 5:
        crowd_level = "Low"

    elif crowd_count <= 15:
        crowd_level = "Moderate"

    else:
        crowd_level = "High"

    # --------------------------------------------------------
    # RETURN ONE CONSISTENT DATASET
    # --------------------------------------------------------

    return {

        "today_appointments":
            today_appointments,

        "system_today_appointments":
            system_today_appointments,

        "active_appointments":
            active_appointments,

        "current_queue":
            current_queue,

        "currently_serving":
            currently_serving,

        "your_token":
            your_token,

        "people_ahead":
            people_ahead,

        "estimated_wait_minutes":
            estimated_wait_minutes,

        "crowd_level":
            crowd_level,

        "crowd_count":
            crowd_count,
    }


# ============================================================
# CREATE APPOINTMENT
# ============================================================

@router.post("")

async def create_appointment(

    data: AppointmentCreate,

    current_user: User = Depends(
        get_current_user
    ),

    db: AsyncSession = Depends(
        get_db
    ),
):

    today = date.today()

    # --------------------------------------------------------
    # VALIDATE DATE
    # --------------------------------------------------------

    if data.appointment_date < today:

        raise HTTPException(
            status_code=400,
            detail="Cannot create an appointment in the past."
        )

    # --------------------------------------------------------
    # UPDATE QUEUE FIRST
    # --------------------------------------------------------

    await expire_old_appointments(db)
    await update_currently_serving(db)

   
    # --------------------------------------------------------
    # CREATE TOKEN ID
    # --------------------------------------------------------

    token_id = str(uuid4())

    queue_position = None
    token_status = "UPCOMING"

    # --------------------------------------------------------
    # TODAY -> ADD TO LIVE QUEUE
    # --------------------------------------------------------

    if data.appointment_date == today:

        max_position_result = await db.execute(
            select(
                func.max(
                    Token.queue_position
                )
            )
            .join(
                Appointment,
                Appointment.token_id
                == Token.token_id
            )
            .where(
                Appointment.appointment_date
                == today,

                Appointment.status
                == "PENDING",

                Token.token_status.in_([
                    "WAITING",
                    "SERVING",
                ]),
            )
        )

        max_position = (
            max_position_result.scalar() or 0
        )

        queue_position = (
            max_position + 1
        )

        token_status = "WAITING"

    # --------------------------------------------------------
    # CREATE APPOINTMENT
    # --------------------------------------------------------

    appointment = Appointment(

        user_id=current_user.user_id,

        token_id=token_id,

        purpose=data.purpose,

        appointment_date=data.appointment_date,

        appointment_time=data.appointment_time,

        status="PENDING",
    )

    db.add(appointment)

    await db.flush()

    # --------------------------------------------------------
    # CREATE TOKEN
    # --------------------------------------------------------

    token = Token(

        token_id=token_id,

        user_id=current_user.user_id,

        queue_position=queue_position,

        priority_type="NORMAL",

        token_status=token_status,
    )

    db.add(token)

    await db.commit()

    # --------------------------------------------------------
    # NORMALIZE TODAY'S QUEUE
    # --------------------------------------------------------

    if data.appointment_date == today:

        await update_currently_serving(db)

    await db.refresh(appointment)
    await db.refresh(token)

    # --------------------------------------------------------
    # CALCULATE PEOPLE AHEAD
    # --------------------------------------------------------

    people_ahead = 0

    if (
        token.token_status == "WAITING"
        and token.queue_position is not None
    ):

        people_ahead = (
            token.queue_position - 1
        )

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {

        "message":
            "Appointment created successfully",

        "appointment_id":
            appointment.appointment_id,

        "display_token":
            display_token(
                appointment.appointment_id
            ),

        "user_id":
            appointment.user_id,

        "token_id":
            appointment.token_id,

        "queue_position":
            token.queue_position,

        "people_ahead":
            people_ahead,

        "purpose":
            appointment.purpose,

        "appointment_date":
            appointment.appointment_date,

        "appointment_time":
            appointment.appointment_time,

        "status":
            appointment.status,

        "token_status":
            token.token_status,
    }


# ============================================================
# GET MY APPOINTMENTS
# ============================================================

@router.get("")

async def get_my_appointments(

    current_user: User = Depends(
        get_current_user
    ),

    db: AsyncSession = Depends(
        get_db
    ),
):

    await expire_old_appointments(db)
    await update_currently_serving(db)

    result = await db.execute(

        select(
            Appointment,
            Token
        )

        .join(
            Token,
            Appointment.token_id
            == Token.token_id
        )

        .where(
            Appointment.user_id
            == current_user.user_id
        )

        .order_by(
            Appointment.appointment_date.desc(),
            Appointment.appointment_time.desc()
        )
    )

    rows = result.all()

    response = []

    for appointment, token in rows:

        people_ahead = 0

        if (
            appointment.appointment_date
            == date.today()

            and appointment.status
            == "PENDING"

            and token.token_status
            == "WAITING"

            and token.queue_position is not None
        ):

            ahead_result = await db.execute(

                select(
                    func.count(
                        Token.token_id
                    )
                )

                .join(
                    Appointment,
                    Appointment.token_id
                    == Token.token_id
                )

                .where(

                    Appointment.appointment_date
                    == date.today(),

                    Appointment.status
                    == "PENDING",

                    Token.token_status.in_([
                        "WAITING",
                        "SERVING",
                    ]),

                    Token.queue_position
                    < token.queue_position
                )
            )

            people_ahead = (
                ahead_result.scalar() or 0
            )

        response.append({

            "appointment_id":
                appointment.appointment_id,

            "display_token":
                display_token(
                    appointment.appointment_id
                ),

            "user_id":
                appointment.user_id,

            "token_id":
                appointment.token_id,

            "queue_position":
                token.queue_position,

            "people_ahead":
                people_ahead,

            "purpose":
                appointment.purpose,

            "appointment_date":
                appointment.appointment_date,

            "appointment_time":
                appointment.appointment_time,

            "status":
                appointment.status,

            "token_status":
                token.token_status,
        })

    return response


# ============================================================
# LIVE DASHBOARD DATA
# ============================================================

@router.get("/dashboard")

async def get_dashboard_data(

    current_user: User = Depends(
        get_current_user
    ),

    db: AsyncSession = Depends(
        get_db
    ),
):

    return await get_live_queue_data(
        db,
        current_user.user_id
    )


# ============================================================
# CANCEL APPOINTMENT
# ============================================================

@router.delete("/{appointment_id}")

async def cancel_appointment(

    appointment_id: int,

    current_user: User = Depends(
        get_current_user
    ),

    db: AsyncSession = Depends(
        get_db
    ),
):

    result = await db.execute(

        select(
            Appointment,
            Token
        )

        .join(
            Token,
            Appointment.token_id
            == Token.token_id
        )

        .where(
            Appointment.appointment_id
            == appointment_id,

            Appointment.user_id
            == current_user.user_id
        )
    )

    row = result.first()

    if not row:

        raise HTTPException(
            status_code=404,
            detail="Appointment not found.",
        )

    appointment, token = row

    if appointment.status != "PENDING":

        raise HTTPException(
            status_code=400,
            detail=(
                "Only pending appointments "
                "can be cancelled."
            )
        )

    appointment.status = "CANCELLED"

    token.token_status = "CANCELLED"

    token.queue_position = None

    await db.commit()

    # Renumber remaining queue correctly
    await update_currently_serving(db)

    return {

        "message":
            "Appointment cancelled successfully"
    }