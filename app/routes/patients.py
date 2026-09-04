from datetime import datetime
from app.services.risk_assessment import assess_patient_risk
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.patient import Patient
from app.models.user import User
from app.utils.auth import get_current_user


router = APIRouter(
    prefix="/patients",
    tags=["Patients"],
)


# =========================================================
# PATIENT PROFILE INPUT
# =========================================================

class PatientProfileCreate(BaseModel):
    age: int
    gender: str
    contact_number: str
    location: str | None = None
    emergency_contact: str | None = None
    blood_group: str | None = None
    allergies: str | None = None
    existing_conditions: str | None = None
    current_medications: str | None = None
    risk_status: str = "NORMAL"


# =========================================================
# RESPONSE HELPER
# =========================================================

def patient_response(patient: Patient, user: User):
    return {
        "patient_id": patient.patient_id,
        "user_id": patient.user_id,
        "full_name": patient.full_name,
        "email": user.email,
        "age": patient.age,
        "gender": patient.gender,
        "contact_number": patient.contact_number,
        "location": patient.location,
        "emergency_contact": patient.emergency_contact,
        "blood_group": patient.blood_group,
        "allergies": patient.allergies,
        "existing_conditions": patient.existing_conditions,
        "current_medications": patient.current_medications,
        "risk_status": patient.risk_status,
        "last_visit": patient.last_visit,
        "next_followup": patient.next_followup,
        "created_at": patient.created_at,
        "updated_at": patient.updated_at,
    }


# =========================================================
# CREATE PATIENT PROFILE
# =========================================================

@router.post("/profile")
async def create_patient_profile(
    data: PatientProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(Patient).where(
            Patient.user_id == current_user.user_id
        )
    )

    existing_patient = result.scalar_one_or_none()

    if existing_patient:
        raise HTTPException(
            status_code=409,
            detail="Patient profile already exists.",
        )

    # Generate a patient ID based on the user ID.
    patient_id = f"P{current_user.user_id}"

    # Make sure the generated ID is not already in use.
    existing_id_result = await db.execute(
        select(Patient).where(
            Patient.patient_id == patient_id
        )
    )

    if existing_id_result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Patient ID already exists.",
        )

    patient = Patient(
        patient_id=patient_id,
        user_id=current_user.user_id,
        full_name=current_user.full_name,
        age=data.age,
        gender=data.gender,
        contact_number=data.contact_number,
        location=data.location,
        emergency_contact=data.emergency_contact,
        blood_group=data.blood_group,
        allergies=data.allergies,
        existing_conditions=data.existing_conditions,
        current_medications=data.current_medications,
        risk_status=assess_patient_risk(
            age=data.age,
            existing_conditions=data.existing_conditions,
            current_medications=data.current_medications,
),
    )

    db.add(patient)

    await db.commit()
    await db.refresh(patient)

    return patient_response(
        patient,
        current_user,
    )


# =========================================================
# GET MY PATIENT PROFILE
# =========================================================

@router.get("/profile")
async def get_my_patient_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
            detail="Patient profile not found.",
        )

    return patient_response(
        patient,
        current_user,
    )


# =========================================================
# UPDATE MY PATIENT PROFILE
# =========================================================

@router.put("/profile")
async def update_my_patient_profile(
    data: PatientProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
            detail="Patient profile not found.",
        )

    patient.full_name = current_user.full_name
    patient.age = data.age
    patient.gender = data.gender
    patient.contact_number = data.contact_number
    patient.location = data.location
    patient.emergency_contact = data.emergency_contact
    patient.blood_group = data.blood_group
    patient.allergies = data.allergies
    patient.existing_conditions = data.existing_conditions
    patient.current_medications = data.current_medications
    patient.risk_status = assess_patient_risk(
        age=data.age,
        existing_conditions=data.existing_conditions,
        current_medications=data.current_medications,
)
    patient.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(patient)

    return {
        "message": "Patient profile updated successfully.",
        **patient_response(
            patient,
            current_user,
        ),
    }

@router.get("/risk")
async def get_patient_risk(
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

    risk_status = assess_patient_risk(
        age=patient.age,
        existing_conditions=patient.existing_conditions,
        current_medications=patient.current_medications,
    )

    patient.risk_status = risk_status
    await db.commit()

    return {
        "patient_id": patient.patient_id,
        "patient_name": patient.full_name,
        "risk_status": risk_status,
        "high_risk": risk_status == "HIGH",
        "message": (
            "Patient requires closer follow-up."
            if risk_status == "HIGH"
            else "Patient is currently classified as normal risk."
        )
    }