from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.follow_up import FollowUp
from app.database import get_db
from app.models.maternal_child import MaternalChildRecord
from app.models.patient import Patient
from app.models.user import User
from app.utils.auth import get_current_user


router = APIRouter(
    prefix="/maternal-child",
    tags=["Maternal & Child Follow-up"],
)


class MaternalChildCreate(BaseModel):
    record_category: str

    pregnancy_status: str | None = None
    pregnancy_start_date: date | None = None
    expected_delivery_date: date | None = None
    anc_visit_date: date | None = None
    anc_notes: str | None = None
    maternal_test_results: str | None = None
    maternal_vaccination: str | None = None

    child_name: str | None = None
    child_date_of_birth: date | None = None
    child_vaccination: str | None = None
    child_checkup_date: date | None = None
    child_checkup_notes: str | None = None

    missed_follow_up: bool = False
    next_follow_up: date | None = None
    notes: str | None = None


def record_response(record: MaternalChildRecord):
    return {
        "record_id": record.record_id,
        "patient_id": record.patient_id,
        "record_category": record.record_category,
        "pregnancy_status": record.pregnancy_status,
        "pregnancy_start_date": record.pregnancy_start_date,
        "expected_delivery_date": record.expected_delivery_date,
        "anc_visit_date": record.anc_visit_date,
        "anc_notes": record.anc_notes,
        "maternal_test_results": record.maternal_test_results,
        "maternal_vaccination": record.maternal_vaccination,
        "child_name": record.child_name,
        "child_date_of_birth": record.child_date_of_birth,
        "child_vaccination": record.child_vaccination,
        "child_checkup_date": record.child_checkup_date,
        "child_checkup_notes": record.child_checkup_notes,
        "missed_follow_up": record.missed_follow_up,
        "next_follow_up": record.next_follow_up,
        "notes": record.notes,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


# =========================================================
# CREATE MATERNAL / CHILD RECORD
# =========================================================

@router.post("")
async def create_maternal_child_record(
    data: MaternalChildCreate,
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

    category = data.record_category.strip().upper()

    if category not in ["MATERNAL", "CHILD"]:
        raise HTTPException(
            status_code=400,
            detail="record_category must be MATERNAL or CHILD.",
        )

    record = MaternalChildRecord(
        patient_id=patient.patient_id,
        record_category=category,
        pregnancy_status=data.pregnancy_status,
        pregnancy_start_date=data.pregnancy_start_date,
        expected_delivery_date=data.expected_delivery_date,
        anc_visit_date=data.anc_visit_date,
        anc_notes=data.anc_notes,
        maternal_test_results=data.maternal_test_results,
        maternal_vaccination=data.maternal_vaccination,
        child_name=data.child_name,
        child_date_of_birth=data.child_date_of_birth,
        child_vaccination=data.child_vaccination,
        child_checkup_date=data.child_checkup_date,
        child_checkup_notes=data.child_checkup_notes,
        missed_follow_up=data.missed_follow_up,
        next_follow_up=data.next_follow_up,
        notes=data.notes,
    )

    db.add(record)

    if data.next_follow_up is not None:
        follow_up = FollowUp(
            patient_id=patient.patient_id,
            follow_up_type=f"{category} Follow-up",
            scheduled_date=data.next_follow_up,
            completed=False,
            missed=data.missed_follow_up,
            alert_status=(
                "MISSED"
                if data.missed_follow_up
                else "PENDING"
        ),
        notes=data.anc_notes or data.child_checkup_notes or data.notes,
    )

    db.add(follow_up)

    await db.commit()
    await db.refresh(record)

    return {
        "message": "Maternal/child record added successfully.",
        **record_response(record),
    }


# =========================================================
# GET MATERNAL / CHILD RECORDS
# =========================================================

@router.get("")
async def get_maternal_child_records(
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
        select(MaternalChildRecord)
        .where(
            MaternalChildRecord.patient_id == patient.patient_id
        )
        .order_by(
            MaternalChildRecord.created_at.desc(),
            MaternalChildRecord.record_id.desc(),
        )
    )

    records = result.scalars().all()

    return {
        "patient_id": patient.patient_id,
        "total_records": len(records),
        "records": [
            record_response(record)
            for record in records
        ],
    }