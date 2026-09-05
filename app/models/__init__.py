"""SQLAlchemy models registry for VIZITOR and Healthcare Network."""

from app.models.user import User
from app.models.hospital import Hospital
from app.models.appointment import Appointment
from app.models.token import Token
from app.models.otp import OTPVerification
from app.models.article import Article
from app.models.arcade_score import ArcadeScore
from app.models.patient import Patient
from app.models.medical_record import MedicalRecord
from app.models.maternal_child import MaternalChildRecord
from app.models.chronic_disease import ChronicDiseaseRecord
from app.models.follow_up import FollowUp
from app.models.facility import Facility, FacilityType
from app.models.department import Department
from app.models.specialist import Specialist, AvailabilityStatus
from app.models.diagnostic import DiagnosticTest, DiagnosticBooking, BookingStatus, ResultStatus
from app.models.medicine import Medicine, FacilityInventory
from app.models.referral import Referral, ReferralPriority, ReferralStatus
from app.models.sms import SMSDeliveryRecord, SMSStatus

__all__ = [
    "User",
    "Hospital",
    "Appointment",
    "Token",
    "OTPVerification",
    "Article",
    "ArcadeScore",
    "Patient",
    "MedicalRecord",
    "MaternalChildRecord",
    "ChronicDiseaseRecord",
    "FollowUp",
    "Facility",
    "FacilityType",
    "Department",
    "Specialist",
    "AvailabilityStatus",
    "DiagnosticTest",
    "DiagnosticBooking",
    "BookingStatus",
    "ResultStatus",
    "Medicine",
    "FacilityInventory",
    "Referral",
    "ReferralPriority",
    "ReferralStatus",
    "SMSDeliveryRecord",
    "SMSStatus",
]
