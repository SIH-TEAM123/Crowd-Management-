"""Pydantic schemas for SMS Token notifications and delivery records."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.sms import SMSStatus


class SMSSendRequest(BaseModel):
    """Payload for triggering or resending appointment token SMS."""
    phone_number: Optional[str] = Field(
        None,
        max_length=32,
        description="Optional recipient mobile phone number override (e.g. +919876543210)",
    )

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            if not clean:
                return None
            digits = "".join(ch for ch in clean if ch.isdigit())
            if len(digits) < 7:
                raise ValueError("Phone number must contain at least 7 digits.")
            return clean
        return None


class SMSTokenResponse(BaseModel):
    """Response returned upon SMS dispatch or resend."""
    appointment_id: str
    token: Optional[int] = None
    phone_number: str = Field(..., description="Masked recipient phone number")
    sms_status: str = Field(..., description="Delivery status: PENDING, SENT, FAILED")
    message: str = Field(..., description="Human-readable outcome description")
    provider_message_id: Optional[str] = None
    sent_at: Optional[datetime] = None


class SMSDeliveryRecordResponse(BaseModel):
    """Detailed audit representation of an SMS dispatch record."""
    id: str
    appointment_id: str
    phone_number: str
    message_type: str
    status: SMSStatus
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
