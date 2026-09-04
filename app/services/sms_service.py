"""SMS Service Abstraction and Provider Infrastructure for Outpatient Queue Tokens."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import logging
import os
import re
from typing import List, Optional, Tuple
import uuid
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.sms import SMSDeliveryRecord, SMSStatus
from app.schemas.sms import SMSTokenResponse

logger = logging.getLogger(__name__)


@dataclass
class SMSProviderResult:
    """Result of an SMS provider dispatch attempt."""
    success: bool
    provider_message_id: Optional[str] = None
    error: Optional[str] = None


class BaseSMSProvider(ABC):
    """Abstract SMS transport provider."""

    @abstractmethod
    def send_sms(self, to_phone: str, message: str) -> SMSProviderResult:
        """Send an SMS message to a mobile number."""
        pass


class MockSMSProvider(BaseSMSProvider):
    """Development and testing mock SMS provider."""

    def __init__(self):
        self.sent_messages: List[dict] = []

    def send_sms(self, to_phone: str, message: str) -> SMSProviderResult:
        # Simulate network or provider validation failure if phone has invalid markers
        clean = to_phone.strip()
        if "fail" in clean.lower() or clean.startswith("000000"):
            error_msg = "Mock provider simulated dispatch failure: Carrier rejected destination."
            logger.warning("[MockSMSProvider] Simulated failure for: %s", SMSService.mask_phone_number(to_phone))
            return SMSProviderResult(success=False, error=error_msg)

        msg_id = f"MOCK_SMS_{uuid.uuid4().hex[:12].upper()}"
        record = {
            "to_phone": to_phone,
            "message": message,
            "provider_message_id": msg_id,
            "timestamp": datetime.now(timezone.utc),
        }
        self.sent_messages.append(record)
        logger.info(
            "[MockSMSProvider] SMS dispatched successfully to %s (ID: %s)",
            SMSService.mask_phone_number(to_phone),
            msg_id,
        )
        return SMSProviderResult(success=True, provider_message_id=msg_id)


class TwilioSMSProvider(BaseSMSProvider):
    """Production-ready Twilio SMS provider reading credentials from environment."""

    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        self.from_phone = os.getenv("TWILIO_PHONE_NUMBER", "")

    def send_sms(self, to_phone: str, message: str) -> SMSProviderResult:
        if not (self.account_sid and self.auth_token and self.from_phone):
            logger.warning("[TwilioSMSProvider] Missing Twilio credentials in environment. Falling back to Mock.")
            return MockSMSProvider().send_sms(to_phone, message)

        try:
            # Lazy import twilio if installed
            import urllib.parse
            import urllib.request
            import base64
            import json

            url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
            data = urllib.parse.urlencode({
                "To": to_phone,
                "From": self.from_phone,
                "Body": message,
            }).encode("utf-8")

            auth_str = f"{self.account_sid}:{self.auth_token}"
            auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("ascii")

            req = urllib.request.Request(
                url,
                data=data,
                headers={
                    "Authorization": f"Basic {auth_b64}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                sid = resp_data.get("sid", f"TW_{uuid.uuid4().hex[:8]}")
                return SMSProviderResult(success=True, provider_message_id=sid)
        except Exception as exc:
            logger.error("[TwilioSMSProvider] Twilio dispatch error: %s", exc)
            return SMSProviderResult(success=False, error=str(exc))


def get_sms_provider() -> BaseSMSProvider:
    """Factory to retrieve configured SMS provider based on environment variables."""
    provider_name = os.getenv("SMS_PROVIDER", "mock").strip().lower()
    if provider_name == "twilio":
        return TwilioSMSProvider()
    return MockSMSProvider()


class SMSService:
    """Service handling outpatient token formatting, dispatch, audit tracking, and abuse prevention."""

    @staticmethod
    def mask_phone_number(phone: str) -> str:
        """Mask middle digits of a phone number for privacy-compliant API responses."""
        if not phone:
            return "N/A"
        clean = phone.strip()
        if len(clean) <= 4:
            return "****"
        
        # Keep prefix (country code if present) and last 4 digits
        if clean.startswith("+"):
            prefix = clean[:3]
            suffix = clean[-4:]
            return f"{prefix} ******{suffix}"
        else:
            suffix = clean[-4:]
            return f"******{suffix}"

    @staticmethod
    def format_token_message(
        appointment: Appointment,
        facility_name: Optional[str] = None,
        specialist_name: Optional[str] = None,
    ) -> str:
        """Generate official token confirmation SMS body."""
        token_num = appointment.token_number or "N/A"
        fac = facility_name or (appointment.facility.name if appointment.facility else "Healthcare Centre")
        spec = specialist_name or (f"Dr. {appointment.specialist.name}" if appointment.specialist else None)
        
        date_str = appointment.appointment_date.strftime("%d-%b-%Y") if appointment.appointment_date else "Today"
        slot_str = appointment.slot_start_time if appointment.slot_start_time else "Regular OPD"

        parts = [
            f"Symmetry Health: Token #{token_num} confirmed for {appointment.patient_name}.",
            f"Facility: {fac}.",
            f"Dept: {appointment.department}.",
        ]
        if spec:
            parts.append(f"Doctor: {spec}.")
        parts.append(f"Date: {date_str} ({slot_str}).")
        parts.append("Please arrive 15 mins prior. Keep this SMS for check-in.")

        return " ".join(parts)

    @classmethod
    def send_token_sms(
        cls,
        db: Session,
        appointment_id: str,
        phone_number: Optional[str] = None,
        provider: Optional[BaseSMSProvider] = None,
    ) -> Tuple[SMSDeliveryRecord, SMSTokenResponse]:
        """Trigger an authoritative server token SMS delivery to patient."""
        appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise ValueError(f"Appointment with ID '{appointment_id}' not found.")

        # Require an authoritative token
        if appointment.token_number is None:
            raise ValueError("Cannot send SMS: Appointment does not have an authoritative token number assigned.")

        # Resolve recipient phone number
        dest_phone = (phone_number or appointment.phone_number or "").strip()
        if not dest_phone:
            raise ValueError("No phone number registered for this appointment.")

        digits = re.sub(r"\D", "", dest_phone)
        if len(digits) < 7:
            raise ValueError("Invalid phone number: Must contain at least 7 digits.")

        # Prevent duplicate rapid resend abuse (within 15 seconds)
        recent_cutoff = datetime.now(timezone.utc) - timedelta(seconds=15)
        recent_sent = (
            db.query(SMSDeliveryRecord)
            .filter(
                SMSDeliveryRecord.appointment_id == appointment_id,
                SMSDeliveryRecord.status == SMSStatus.SENT,
                SMSDeliveryRecord.created_at >= recent_cutoff,
            )
            .first()
        )
        if recent_sent:
            masked = cls.mask_phone_number(dest_phone)
            return recent_sent, SMSTokenResponse(
                appointment_id=appointment.id,
                token=appointment.token_number,
                phone_number=masked,
                sms_status=recent_sent.status.value,
                message=f"SMS token was recently sent to {masked}. Please wait before resending.",
                provider_message_id=recent_sent.provider_message_id,
                sent_at=recent_sent.sent_at,
            )

        # Build message body
        fac_name = appointment.facility.name if appointment.facility else None
        spec_name = appointment.specialist.name if appointment.specialist else None
        message_body = cls.format_token_message(appointment, fac_name, spec_name)

        # Create audit record
        sms_record = SMSDeliveryRecord(
            appointment_id=appointment.id,
            phone_number=dest_phone,
            message_type="TOKEN_CONFIRMATION",
            message_body=message_body,
            status=SMSStatus.PENDING,
        )
        db.add(sms_record)
        db.commit()
        db.refresh(sms_record)

        # Dispatch via SMS provider
        active_provider = provider or get_sms_provider()
        res = active_provider.send_sms(dest_phone, message_body)

        now = datetime.now(timezone.utc)
        if res.success:
            sms_record.status = SMSStatus.SENT
            sms_record.provider_message_id = res.provider_message_id
            sms_record.sent_at = now
            sms_record.error_message = None
            message_text = f"Token SMS delivered successfully to {cls.mask_phone_number(dest_phone)}."
        else:
            sms_record.status = SMSStatus.FAILED
            sms_record.error_message = res.error
            message_text = f"SMS delivery failed: {res.error or 'Unknown provider error'}."

        db.commit()
        db.refresh(sms_record)

        masked_phone = cls.mask_phone_number(dest_phone)
        response = SMSTokenResponse(
            appointment_id=appointment.id,
            token=appointment.token_number,
            phone_number=masked_phone,
            sms_status=sms_record.status.value,
            message=message_text,
            provider_message_id=sms_record.provider_message_id,
            sent_at=sms_record.sent_at,
        )
        return sms_record, response

    @staticmethod
    def get_appointment_sms_records(db: Session, appointment_id: str) -> List[SMSDeliveryRecord]:
        """Fetch all SMS audit logs for an appointment."""
        return (
            db.query(SMSDeliveryRecord)
            .filter(SMSDeliveryRecord.appointment_id == appointment_id)
            .order_by(SMSDeliveryRecord.created_at.desc())
            .all()
        )
