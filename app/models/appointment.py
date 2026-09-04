"""SQLAlchemy models for Patient Appointments and OPD Queue Tokens."""

from datetime import datetime, timezone
import enum
import uuid
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.database import Base


class AppointmentStatus(str, enum.Enum):
    """Lifecycle and queue states for outpatient appointments and tokens."""
    SCHEDULED = "SCHEDULED"
    CHECKED_IN = "CHECKED_IN"
    IN_CONSULTATION = "IN_CONSULTATION"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class Appointment(Base):
    """Patient clinical appointment and queue token model."""
    __tablename__ = "appointments"

    id = Column(
        String(64),
        primary_key=True,
        index=True,
        default=lambda: f"APT_{uuid.uuid4().hex[:12]}",
    )
    facility_id = Column(
        String(64),
        ForeignKey("facilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    patient_id = Column(String(64), nullable=True, index=True)
    patient_name = Column(String(255), nullable=False)
    phone_number = Column(String(32), nullable=True, index=True)
    specialist_id = Column(
        String(64),
        ForeignKey("specialists.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    token_number = Column(Integer, nullable=True, index=True)
    status = Column(
        SQLEnum(AppointmentStatus),
        default=AppointmentStatus.SCHEDULED,
        nullable=False,
        index=True,
    )
    department = Column(String(100), default="OPD", nullable=False)
    slot_start_time = Column(String(10), nullable=True, index=True)
    slot_end_time = Column(String(10), nullable=True)
    appointment_date = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    check_in_time = Column(DateTime(timezone=True), nullable=True)
    consultation_start_time = Column(DateTime(timezone=True), nullable=True)
    completed_time = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    facility = relationship("Facility", back_populates="appointments")
    specialist = relationship("Specialist")
    sms_records = relationship("SMSDeliveryRecord", back_populates="appointment", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return (
            f"<Appointment(id='{self.id}', patient='{self.patient_name}', "
            f"token={self.token_number}, status='{self.status}')>"
        )
