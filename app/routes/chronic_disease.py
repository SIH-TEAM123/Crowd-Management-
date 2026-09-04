from datetime import date
from app.models.follow_up import FollowUp
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.chronic_disease import ChronicDiseaseRecord
from app.models.patient import Patient
from app.models.user import User
from app.utils.auth import get_current_user


router = APIRouter(
    prefix="/chronic-disease",
    tags=["Chronic Disease Follow-up"],
)


class ChronicDiseaseCreate(BaseModel):
    disease_name: str
    diagnosis_status: str

    diagnosis_date: date | None = None
    medication: str | None = None
    checkup_date: date | None = None
    checkup_notes: str | None = None
    next_follow_up: date | None = None

    missed_visit: bool = False
    reminder_status: str = "PENDING"
    notes: str | None = None


def chronic_disease_response(record: ChronicDiseaseRecord):
    return {
        "record_id": record.record_id,
        "patient_id": record.patient_id,
        "disease_name": record.disease_name,
        "diagnosis_status": record.diagnosis_status,
        "diagnosis_date": record.diagnosis_date,
        "medication": record.medication,
        "checkup_date": record.checkup_date,
        "checkup_notes": record.checkup_notes,
        "next_follow_up": record.next_follow_up,
        "missed_visit": record.missed_visit,
        "reminder_status": record.reminder_status,
        "notes": record.notes,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


# =========================================================
# CREATE CHRONIC DISEASE RECORD
# =========================================================

@router.post("")
async def create_chronic_disease_record(
    data: ChronicDiseaseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    patient_result = await db.execute(
        select(Patient).where(
            Patient.user_id == current_user.user_id
        )
    )

    patient = patient_result.scalar_one_or_none()

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found.",
        )

    disease_name = data.disease_name.strip()

    if not disease_name:
        raise HTTPException(
            status_code=400,
            detail="Disease name is required.",
        )

    diagnosis_status = data.diagnosis_status.strip().upper()

    if diagnosis_status not in [
        "ACTIVE",
        "CONTROLLED",
        "INACTIVE",
        "UNDER_TREATMENT",
    ]:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid diagnosis status. "
                "Use ACTIVE, CONTROLLED, INACTIVE, "
                "or UNDER_TREATMENT."
            ),
        )

    reminder_status = data.reminder_status.strip().upper()

    if reminder_status not in [
        "PENDING",
        "SENT",
        "COMPLETED",
        "MISSED",
    ]:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid reminder status. "
                "Use PENDING, SENT, COMPLETED, or MISSED."
            ),
        )

    record = ChronicDiseaseRecord(
        patient_id=patient.patient_id,
        disease_name=disease_name,
        diagnosis_status=diagnosis_status,
        diagnosis_date=data.diagnosis_date,
        medication=data.medication,
        checkup_date=data.checkup_date,
        checkup_notes=data.checkup_notes,
        next_follow_up=data.next_follow_up,
        missed_visit=data.missed_visit,
        reminder_status=reminder_status,
        notes=data.notes,
    )

    db.add(record)
    if data.next_follow_up is not None:
        follow_up = FollowUp(
            patient_id=patient.patient_id,
            follow_up_type=f"{disease_name} Follow-up",
            scheduled_date=data.next_follow_up,
            completed=False,
            missed=data.missed_visit,
            alert_status=(
                "MISSED"
                if data.missed_visit
                else "PENDING"
            ),
            notes=data.checkup_notes,
        )
        db.add(follow_up)

    await db.commit()
    await db.refresh(record)

    return {
        "message": "Chronic disease record added successfully.",
        **chronic_disease_response(record),
    }


# =========================================================
# GET CHRONIC DISEASE RECORDS
# =========================================================

@router.get("")
async def get_chronic_disease_records(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    patient_result = await db.execute(
        select(Patient).where(
            Patient.user_id == current_user.user_id
        )
    )

    patient = patient_result.scalar_one_or_none()

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found.",
        )

    result = await db.execute(
        select(ChronicDiseaseRecord)
        .where(
            ChronicDiseaseRecord.patient_id
            == patient.patient_id
        )
        .order_by(
            ChronicDiseaseRecord.created_at.desc(),
            ChronicDiseaseRecord.record_id.desc(),
        )
    )

    records = result.scalars().all()

    return {
        "patient_id": patient.patient_id,
        "total_records": len(records),
        "records": [
            chronic_disease_response(record)
            for record in records
        ],
    }