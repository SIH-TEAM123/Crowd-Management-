"""Database models package."""

from app.models.facility import Facility, FacilityType
from app.models.specialist import Specialist, AvailabilityStatus
from app.models.diagnostic import (
    DiagnosticTest,
    DiagnosticBooking,
    BookingStatus,
    ResultStatus,
    VALID_BOOKING_TRANSITIONS,
)
from app.models.medicine import Medicine, FacilityInventory
from app.models.referral import (
    Referral,
    ReferralPriority,
    ReferralStatus,
    VALID_REFERRAL_TRANSITIONS,
)
from app.models.department import Department
from app.models.appointment import Appointment, AppointmentStatus
from app.models.sms import SMSDeliveryRecord, SMSStatus

__all__ = [
    "Facility",
    "FacilityType",
    "Department",
    "Specialist",
    "AvailabilityStatus",
    "DiagnosticTest",
    "DiagnosticBooking",
    "BookingStatus",
    "ResultStatus",
    "VALID_BOOKING_TRANSITIONS",
    "Medicine",
    "FacilityInventory",
    "Referral",
    "ReferralPriority",
    "ReferralStatus",
    "VALID_REFERRAL_TRANSITIONS",
    "Appointment",
    "AppointmentStatus",
    "SMSDeliveryRecord",
    "SMSStatus",
]
