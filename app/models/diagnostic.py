"""SQLAlchemy models for Diagnostic Tests and Diagnostic Bookings with Lifecycle State Machine."""

from datetime import datetime, timezone
import enum
import uuid
from sqlalchemy import Boolean, Column, DateTime, Enum as SQLEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.database import Base


class BookingStatus(str, enum.Enum):
    """Lifecycle states for diagnostic test bookings."""
    REQUESTED = "REQUESTED"
    BOOKED = "BOOKED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"


class ResultStatus(str, enum.Enum):
    """Result availability status for a diagnostic test booking."""
    PENDING = "PENDING"
    AVAILABLE = "AVAILABLE"


# Valid state machine transitions
VALID_BOOKING_TRANSITIONS = {
    BookingStatus.REQUESTED: {BookingStatus.BOOKED, BookingStatus.CANCELLED, BookingStatus.FAILED},
    BookingStatus.BOOKED: {BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED, BookingStatus.FAILED},
    BookingStatus.IN_PROGRESS: {BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.FAILED},
    BookingStatus.COMPLETED: set(),
    BookingStatus.CANCELLED: set(),
    BookingStatus.FAILED: set(),
}


class DiagnosticTest(Base):
    """Diagnostic service/test offered at a healthcare facility."""
    __tablename__ = "diagnostic_tests"

    id = Column(
        String(64),
        primary_key=True,
        index=True,
        default=lambda: f"DIAG_{uuid.uuid4().hex[:12]}",
    )
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=True, index=True)
    facility_id = Column(
        String(64),
        ForeignKey("facilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_available = Column(Boolean, default=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    cost = Column(Float, nullable=True)
    estimated_duration_minutes = Column(Integer, nullable=True)
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

    facility = relationship("Facility", back_populates="diagnostics")
    bookings = relationship("DiagnosticBooking", back_populates="diagnostic", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<DiagnosticTest(id='{self.id}', name='{self.name}', facility_id='{self.facility_id}', available={self.is_available})>"


class DiagnosticBooking(Base):
    """Booking and queue tracking for a diagnostic test."""
    __tablename__ = "diagnostic_bookings"

    id = Column(
        String(64),
        primary_key=True,
        index=True,
        default=lambda: f"BKG_{uuid.uuid4().hex[:12]}",
    )
    diagnostic_id = Column(
        String(64),
        ForeignKey("diagnostic_tests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    facility_id = Column(
        String(64),
        ForeignKey("facilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    patient_id = Column(String(64), nullable=True, index=True)
    patient_name = Column(String(255), nullable=False)
    status = Column(
        SQLEnum(BookingStatus),
        default=BookingStatus.REQUESTED,
        nullable=False,
        index=True,
    )
    result_status = Column(
        SQLEnum(ResultStatus),
        default=ResultStatus.PENDING,
        nullable=False,
        index=True,
    )
    booking_time = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    in_progress_time = Column(DateTime(timezone=True), nullable=True)
    completed_time = Column(DateTime(timezone=True), nullable=True)
    cancelled_time = Column(DateTime(timezone=True), nullable=True)
    result_available_time = Column(DateTime(timezone=True), nullable=True)
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

    diagnostic = relationship("DiagnosticTest", back_populates="bookings")
    facility = relationship("Facility")

    def __repr__(self) -> str:
        return f"<DiagnosticBooking(id='{self.id}', test='{self.diagnostic_id}', status='{self.status}')>"
