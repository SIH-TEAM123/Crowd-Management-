from fastapi import APIRouter
from pydantic import BaseModel

from app.services.triage import assess_symptoms


router = APIRouter(
    prefix="/triage",
    tags=["Digital Triage"],
)


class TriageRequest(BaseModel):
    symptoms: str


@router.post("")
async def digital_triage(data: TriageRequest):

    result = assess_symptoms(data.symptoms)

    return {
        "priority": result.priority,
        "department": result.department,
        "reason": result.reason,
        "emergency": result.emergency,
        "disclaimer": (
            "This digital triage result is for preliminary "
            "guidance only and is not a medical diagnosis."
        ),
    }

@router.post("/appointment-recommendation")
async def triage_appointment_recommendation(data: TriageRequest):

    result = assess_symptoms(data.symptoms)

    return {
        "priority_type": result.priority,
        "recommended_department": result.department,
        "reason": result.reason,
        "emergency": result.emergency,
        "appointment_priority": result.priority,
        "disclaimer": (
            "This recommendation is for preliminary guidance only "
            "and is not a medical diagnosis."
        ),
    }