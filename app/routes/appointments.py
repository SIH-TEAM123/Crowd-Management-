from datetime import date, time
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
            "purpose": appointment.purpose,
            "appointment_date": appointment.appointment_date,
            "appointment_time": appointment.appointment_time,
            "status": appointment.status,
        }
        for appointment in appointments
    ]


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