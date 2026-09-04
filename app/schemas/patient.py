from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class PatientBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    age: int = Field(..., ge=0, le=150)
    gender: str = Field(..., min_length=1, max_length=20)
    contact_number: str = Field(..., min_length=5, max_length=20)

    location: str | None = Field(
        default=None,
        max_length=255
    )

    emergency_contact: str | None = Field(
        default=None,
        max_length=255
    )

    blood_group: str | None = Field(
        default=None,
        max_length=10
    )

    allergies: str | None = None
    existing_conditions: str | None = None
    current_medications: str | None = None

    risk_status: str = Field(
        default="NORMAL",
        max_length=20
    )

    last_visit: date | None = None
    next_followup: date | None = None


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    full_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    age: int | None = Field(
        default=None,
        ge=0,
        le=150
    )

    gender: str | None = Field(
        default=None,
        max_length=20
    )

    contact_number: str | None = Field(
        default=None,
        min_length=5,
        max_length=20
    )

    location: str | None = Field(
        default=None,
        max_length=255
    )

    emergency_contact: str | None = Field(
        default=None,
        max_length=255
    )

    blood_group: str | None = Field(
        default=None,
        max_length=10
    )

    allergies: str | None = None
    existing_conditions: str | None = None
    current_medications: str | None = None

    risk_status: str | None = Field(
        default=None,
        max_length=20
    )

    last_visit: date | None = None
    next_followup: date | None = None


class PatientResponse(PatientBase):
    patient_id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )