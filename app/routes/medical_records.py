from datetime import date,time
from app.models.appointment import Appointment
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.routes.appointments import token_display_for
from app.database import get_db
from app.models.medical_record import MedicalRecord
from app.models.patient import Patient
from app.models.user import User
from app.utils.auth import get_current_user


router = APIRouter(
    prefix="/medical-records",
    tags=["Medical Records"],
)


class MedicalRecordCreate(BaseModel):
    record_type: str = Field(..., min_length=2, max_length=50)
    visit_date: date

    facility_name: str | None = None
    department: str | None = None
    diagnosis: str | None = None
    prescription: str | None = None
    test_results: str | None = None
    referral: str | None = None
    follow_up_notes: str | None = None


@router.post("")
async def create_medical_record(
    data: MedicalRecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Find the logged-in user's patient profile
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

    record = MedicalRecord(
        patient_id=patient.patient_id,
        record_type=data.record_type,
        visit_date=data.visit_date,
        facility_name=data.facility_name,
        department=data.department,
        diagnosis=data.diagnosis,
        prescription=data.prescription,
        test_results=data.test_results,
        referral=data.referral,
        follow_up_notes=data.follow_up_notes,
    )

    db.add(record)

    # Update patient's last visit when this record represents a visit
    if data.visit_date:
        if patient.last_visit is None or data.visit_date > patient.last_visit:
            patient.last_visit = data.visit_date

    await db.commit()
    await db.refresh(record)

    return {
        "message": "Medical record added successfully.",
        "record_id": record.record_id,
        "patient_id": record.patient_id,
        "record_type": record.record_type,
        "visit_date": record.visit_date,
        "facility_name": record.facility_name,
        "department": record.department,
        "diagnosis": record.diagnosis,
        "prescription": record.prescription,
        "test_results": record.test_results,
        "referral": record.referral,
        "follow_up_notes": record.follow_up_notes,
        "created_at": record.created_at,
    }


@router.get("")
async def get_my_medical_records(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Find the logged-in user's patient profile
    patient_result = await db.execute(
        select(Patient).where(
            Patient.user_id == current_user.user_id
        )
    )

    patient = patient_result.scalar_one_or_none()

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found."
        )

    # Get timeline in newest-first order
    result = await db.execute(
        select(MedicalRecord)
        .where(
            MedicalRecord.patient_id == patient.patient_id
        )
        .order_by(
            MedicalRecord.visit_date.desc(),
            MedicalRecord.record_id.desc()
        )
    )

    records = result.scalars().all()

    return {
        "patient_id": patient.patient_id,
        "total_records": len(records),
        "records": [
            {
                "record_id": record.record_id,
                "record_type": record.record_type,
                "visit_date": record.visit_date,
                "facility_name": record.facility_name,
                "department": record.department,
                "diagnosis": record.diagnosis,
                "prescription": record.prescription,
                "test_results": record.test_results,
                "referral": record.referral,
                "follow_up_notes": record.follow_up_notes,
                "created_at": record.created_at,
            }
            for record in records
        ],
    }

    # =========================================================
# PATIENT 360 MEDICAL TIMELINE
# =========================================================

@router.get("/timeline")
async def get_patient_360_timeline(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # -----------------------------------------------------
    # Find the logged-in user's patient profile
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # Get medical records
    # -----------------------------------------------------

    records_result = await db.execute(
        select(MedicalRecord)
        .where(
            MedicalRecord.patient_id == patient.patient_id
        )
        .order_by(
            MedicalRecord.visit_date.desc(),
            MedicalRecord.record_id.desc(),
        )
    )

    records = records_result.scalars().all()

    # -----------------------------------------------------
    # Get appointments
    # -----------------------------------------------------

    appointments_result = await db.execute(
        select(Appointment)
        .where(
            Appointment.user_id == current_user.user_id
        )
        .order_by(
            Appointment.appointment_date.desc(),
            Appointment.appointment_time.desc(),
            Appointment.appointment_id.desc(),
        )
    )

    appointments = appointments_result.scalars().all()

    # -----------------------------------------------------
    # Build unified timeline
    # -----------------------------------------------------

    timeline = []

    # Medical records
    for record in records:
        timeline.append(
            {
                "timeline_type": "MEDICAL_RECORD",
                "date": record.visit_date,
                "record_id": record.record_id,
                "record_type": record.record_type,
                "facility_name": record.facility_name,
                "department": record.department,
                "diagnosis": record.diagnosis,
                "prescription": record.prescription,
                "test_results": record.test_results,
                "referral": record.referral,
                "follow_up_notes": record.follow_up_notes,
            }
        )

    # Appointments
    for appointment in appointments:
        timeline.append(
            {
                "timeline_type": "APPOINTMENT",
                "date": appointment.appointment_date,
                "appointment_id": appointment.appointment_id,
                "token_number": token_display_for(
                    appointment.appointment_id
                ),
                "purpose": appointment.purpose,
                "appointment_time": appointment.appointment_time,
                "status": appointment.status,
            }
        )

    # -----------------------------------------------------
    # Sort everything newest first
    # -----------------------------------------------------

    timeline.sort(
        key=lambda item: (
            item["date"],
            item.get("appointment_time", time.min),
        ),
        reverse=True,
    )

    return {
        "patient_id": patient.patient_id,
        "patient_name": patient.full_name,
        "total_timeline_events": len(timeline),
        "timeline": timeline,
    }