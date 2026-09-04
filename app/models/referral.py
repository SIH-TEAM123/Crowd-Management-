"""SQLAlchemy model for Inter-Facility Healthcare Referrals with Lifecycle State Machine."""

from datetime import datetime, timezone
import enum
import uuid
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from app.database import Base


class ReferralPriority(str, enum.Enum):
    """Priority level for clinical referrals."""
    ROUTINE = "ROUTINE"
    URGENT = "URGENT"
    EMERGENCY = "EMERGENCY"


class ReferralStatus(str, enum.Enum):
    """Lifecycle states for patient referrals across facilities."""
    CREATED = "CREATED"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    MISSED = "MISSED"


# Strict state machine transition rules
VALID_REFERRAL_TRANSITIONS = {
    ReferralStatus.CREATED: {ReferralStatus.ACCEPTED, ReferralStatus.FAILED, ReferralStatus.MISSED},
    ReferralStatus.ACCEPTED: {ReferralStatus.IN_PROGRESS, ReferralStatus.FAILED, ReferralStatus.MISSED},
    ReferralStatus.IN_PROGRESS: {ReferralStatus.COMPLETED, ReferralStatus.FAILED, ReferralStatus.MISSED},
    ReferralStatus.COMPLETED: set(),
    ReferralStatus.FAILED: set(),
    ReferralStatus.MISSED: set(),
}


class Referral(Base):
    """Inter-facility referral tracking patient movement across healthcare tiers."""
    __tablename__ = "referrals"

    id = Column(
        String(64),
        primary_key=True,
        index=True,
        default=lambda: f"REF_{uuid.uuid4().hex[:12]}",
    )
    patient_id = Column(String(64), nullable=True, index=True)
    patient_name = Column(String(255), nullable=False)
    source_facility_id = Column(
        String(64),
        ForeignKey("facilities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    destination_facility_id = Column(
        String(64),
        ForeignKey("facilities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reason = Column(Text, nullable=False)
    required_specialization = Column(String(100), nullable=True, index=True)
    required_diagnostic = Column(String(255), nullable=True)
    required_medicine = Column(String(255), nullable=True)
    priority = Column(
        SQLEnum(ReferralPriority),
        default=ReferralPriority.ROUTINE,
        nullable=False,
        index=True,
    )
    status = Column(
        SQLEnum(ReferralStatus),
        default=ReferralStatus.CREATED,
        nullable=False,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    source_facility = relationship(
        "Facility",
        foreign_keys=[source_facility_id],
        backref="outgoing_referrals",
    )
    destination_facility = relationship(
        "Facility",
        foreign_keys=[destination_facility_id],
        backref="incoming_referrals",
    )

    def __repr__(self) -> str:
        return (
            f"<Referral(id='{self.id}', patient='{self.patient_name}', "
            f"from='{self.source_facility_id}' to='{self.destination_facility_id}', "
            f"status='{self.status}', priority='{self.priority}')>"
        )
