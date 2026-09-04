"""SQLAlchemy model for SMS Token and Notification Delivery Records."""

from datetime import datetime, timezone
import enum
import uuid
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from app.database import Base


class SMSStatus(str, enum.Enum):
    """Lifecycle states for SMS dispatch."""
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class SMSDeliveryRecord(Base):
    """Audit and delivery tracking model for outpatient token SMS messages."""
    __tablename__ = "sms_delivery_records"

    id = Column(
        String(64),
        primary_key=True,
        index=True,
        default=lambda: f"SMS_{uuid.uuid4().hex[:12]}",
    )
    appointment_id = Column(
        String(64),
        ForeignKey("appointments.appointment_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    phone_number = Column(String(32), nullable=False, index=True)
    message_type = Column(String(50), default="TOKEN_NOTIFICATION", nullable=False)
    message_body = Column(Text, nullable=True)
    status = Column(
        SQLEnum(SMSStatus),
        default=SMSStatus.PENDING,
        nullable=False,
        index=True,
    )
    provider_message_id = Column(String(128), nullable=True)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
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

    appointment = relationship("Appointment", back_populates="sms_records")

    def __repr__(self) -> str:
        return (
            f"<SMSDeliveryRecord(id='{self.id}', appointment_id='{self.appointment_id}', "
            f"phone='{self.phone_number}', status='{self.status}')>"
        )
