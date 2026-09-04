from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.follow_up import FollowUp
from app.models.patient import Patient
from app.models.user import User
from app.utils.auth import get_current_user


router = APIRouter(
    prefix="/follow-ups",
    tags=["Follow-ups"]
)


class FollowUpCreate(BaseModel):
    follow_up_type: str
    scheduled_date: date
    notes: str | None = None


@router.post("")
async def create_follow_up(
    data: FollowUpCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Patient).where(
            Patient.user_id == current_user.user_id
        )
    )

    patient = result.scalar_one_or_none()

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found."
        )

    follow_up = FollowUp(
        patient_id=patient.patient_id,
        follow_up_type=data.follow_up_type,
        scheduled_date=data.scheduled_date,
        notes=data.notes,
        completed=False,
        missed=False,
        alert_status="PENDING"
    )

    db.add(follow_up)

    await db.commit()
    await db.refresh(follow_up)

    return {
        "message": "Follow-up scheduled successfully.",
        "follow_up_id": follow_up.follow_up_id,
        "patient_id": follow_up.patient_id,
        "follow_up_type": follow_up.follow_up_type,
        "scheduled_date": follow_up.scheduled_date,
        "completed": follow_up.completed,
        "missed": follow_up.missed,
        "alert_status": follow_up.alert_status,
        "notes": follow_up.notes
    }


@router.get("")
async def get_follow_ups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Patient).where(
            Patient.user_id == current_user.user_id
        )
    )

    patient = result.scalar_one_or_none()

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found."
        )

    result = await db.execute(
        select(FollowUp)
        .where(FollowUp.patient_id == patient.patient_id)
        .order_by(
            FollowUp.scheduled_date.asc(),
            FollowUp.follow_up_id.asc()
        )
    )

    follow_ups = result.scalars().all()

    return {
        "patient_id": patient.patient_id,
        "total_follow_ups": len(follow_ups),
        "follow_ups": [
            {
                "follow_up_id": item.follow_up_id,
                "follow_up_type": item.follow_up_type,
                "scheduled_date": item.scheduled_date,
                "completed": item.completed,
                "missed": item.missed,
                "alert_status": item.alert_status,
                "notes": item.notes
            }
            for item in follow_ups
        ]
    }

@router.get("/alerts")
async def get_follow_up_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Patient).where(
            Patient.user_id == current_user.user_id
        )
    )

    patient = result.scalar_one_or_none()

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found."
        )

    result = await db.execute(
        select(FollowUp)
        .where(FollowUp.patient_id == patient.patient_id)
        .order_by(FollowUp.scheduled_date.asc())
    )

    follow_ups = result.scalars().all()

    today = date.today()

    alerts = []

    for item in follow_ups:
        if item.completed:
            status = "COMPLETED"

        elif item.scheduled_date < today:
            status = "MISSED"
            item.missed = True
            item.alert_status = "MISSED"

        elif item.scheduled_date == today:
            status = "DUE_TODAY"
            item.alert_status = "DUE"

        else:
            status = "UPCOMING"

        alerts.append({
            "follow_up_id": item.follow_up_id,
            "follow_up_type": item.follow_up_type,
            "scheduled_date": item.scheduled_date,
            "status": status,
            "completed": item.completed,
            "missed": item.missed,
            "alert_status": item.alert_status,
            "notes": item.notes
        })

    await db.commit()

    return {
        "patient_id": patient.patient_id,
        "total_alerts": len(alerts),
        "alerts": alerts
    }