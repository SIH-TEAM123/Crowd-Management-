"""SQLAlchemy Specialist model for managing healthcare specialists and their real-time availability."""

from datetime import datetime, timezone
import enum
import uuid
from sqlalchemy import Boolean, Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class AvailabilityStatus(str, enum.Enum):
    """Availability states for medical specialists."""
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"
    ON_LEAVE = "ON_LEAVE"
    BUSY = "BUSY"


class Specialist(Base):
    """Medical specialist attached to a healthcare facility."""
    __tablename__ = "specialists"

    id = Column(
        String(64),
        primary_key=True,
        index=True,
        default=lambda: f"SPEC_{uuid.uuid4().hex[:12]}",
    )
    name = Column(String(255), nullable=False, index=True)
    specialization = Column(String(100), nullable=False, index=True)
    department = Column(String(100), nullable=True, index=True)
    facility_id = Column(
        String(64),
        ForeignKey("facilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    availability_status = Column(
        SQLEnum(AvailabilityStatus),
        default=AvailabilityStatus.AVAILABLE,
        nullable=False,
        index=True,
    )
    schedule_info = Column(String(255), nullable=True)
    opd_start_time = Column(String(10), default="09:00", nullable=True)
    opd_end_time = Column(String(10), default="17:00", nullable=True)
    slot_duration_minutes = Column(Integer, default=15, nullable=True)
    working_days = Column(String(100), default="Monday,Tuesday,Wednesday,Thursday,Friday,Saturday", nullable=True)
    break_start_time = Column(String(10), default="13:00", nullable=True)
    break_end_time = Column(String(10), default="14:00", nullable=True)
    is_schedule_active = Column(Boolean, default=True, nullable=True)
    contact_phone = Column(String(50), nullable=True)
    contact_email = Column(String(100), nullable=True)
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

    facility = relationship("Facility", back_populates="specialists")

    def __repr__(self) -> str:
        return (
            f"<Specialist(id='{self.id}', name='{self.name}', "
            f"specialization='{self.specialization}', status='{self.availability_status}')>"
        )
