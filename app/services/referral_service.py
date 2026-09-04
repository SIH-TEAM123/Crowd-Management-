"""Inter-Facility Referral Service managing referral validation, lifecycle state transitions, and audit tracking."""

from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.facility import Facility
from app.models.referral import (
    Referral,
    ReferralPriority,
    ReferralStatus,
    VALID_REFERRAL_TRANSITIONS,
)
from app.schemas.referral import ReferralCreate


class ReferralService:
    """Service layer managing inter-facility patient referrals and strict lifecycle progression."""

    @staticmethod
    def create_referral(db: Session, referral_in: ReferralCreate) -> Referral:
        """Create a new inter-facility referral after validating source and destination healthcare facilities.

        Raises:
            ValueError: If source == destination, or if either facility does not exist.
        """
        if referral_in.source_facility_id == referral_in.destination_facility_id:
            raise ValueError("Source facility and destination facility cannot be the same.")

        source_facility = (
            db.query(Facility).filter(Facility.id == referral_in.source_facility_id).first()
        )
        if not source_facility:
            raise ValueError(
                f"Source facility with ID '{referral_in.source_facility_id}' does not exist."
            )

        dest_facility = (
            db.query(Facility).filter(Facility.id == referral_in.destination_facility_id).first()
        )
        if not dest_facility:
            raise ValueError(
                f"Destination facility with ID '{referral_in.destination_facility_id}' does not exist."
            )

        now = datetime.now(timezone.utc)
        db_ref = Referral(
            id=referral_in.id or None,
            patient_id=referral_in.patient_id,
            patient_name=referral_in.patient_name,
            source_facility_id=referral_in.source_facility_id,
            destination_facility_id=referral_in.destination_facility_id,
            reason=referral_in.reason,
            required_specialization=referral_in.required_specialization,
            required_diagnostic=referral_in.required_diagnostic,
            required_medicine=referral_in.required_medicine,
            priority=referral_in.priority,
            status=ReferralStatus.CREATED,
            created_at=now,
            notes=referral_in.notes,
        )
        db.add(db_ref)
        db.commit()
        db.refresh(db_ref)
        return db_ref

    @staticmethod
    def get_referral_by_id(db: Session, referral_id: str) -> Optional[Referral]:
        """Retrieve a referral record by ID."""
        return db.query(Referral).filter(Referral.id == referral_id).first()

    @staticmethod
    def get_referrals(
        db: Session,
        source_facility_id: Optional[str] = None,
        destination_facility_id: Optional[str] = None,
        patient_id: Optional[str] = None,
        status: Optional[ReferralStatus] = None,
        priority: Optional[ReferralPriority] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Referral]:
        """Query patient referrals with optional filters."""
        query = db.query(Referral)

        if source_facility_id:
            query = query.filter(Referral.source_facility_id == source_facility_id)

        if destination_facility_id:
            query = query.filter(Referral.destination_facility_id == destination_facility_id)

        if patient_id:
            query = query.filter(Referral.patient_id == patient_id)

        if status:
            query = query.filter(Referral.status == status)

        if priority:
            query = query.filter(Referral.priority == priority)

        return query.order_by(Referral.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def update_referral_status(
        db: Session,
        referral_id: str,
        new_status: ReferralStatus,
        notes: Optional[str] = None,
    ) -> Referral:
        """Advance referral through the formal lifecycle state machine.

        Transitions:
            CREATED -> ACCEPTED -> IN_PROGRESS -> COMPLETED
            (and FAILED / MISSED from active states)

        Raises:
            ValueError: If referral not found or invalid state transition attempted.
        """
        ref = db.query(Referral).filter(Referral.id == referral_id).first()
        if not ref:
            raise ValueError(f"Referral with ID '{referral_id}' not found.")

        current_status = ref.status

        # Idempotent if same status
        if current_status == new_status:
            if notes:
                ref.notes = f"{ref.notes or ''}\n{notes}".strip()
                db.commit()
                db.refresh(ref)
            return ref

        # Strict state machine verification
        allowed_next_states = VALID_REFERRAL_TRANSITIONS.get(current_status, set())
        if new_status not in allowed_next_states:
            raise ValueError(
                f"Invalid state transition: Cannot advance referral '{referral_id}' "
                f"from '{current_status.value}' to '{new_status.value}'."
            )

        now = datetime.now(timezone.utc)
        ref.status = new_status

        if new_status == ReferralStatus.ACCEPTED:
            ref.accepted_at = now
        elif new_status == ReferralStatus.IN_PROGRESS:
            ref.started_at = now
        elif new_status == ReferralStatus.COMPLETED:
            ref.completed_at = now
        elif new_status in (ReferralStatus.FAILED, ReferralStatus.MISSED):
            ref.failed_at = now

        if notes:
            ref.notes = f"{ref.notes or ''}\n[{now.isoformat()}] {notes}".strip()

        db.commit()
        db.refresh(ref)
        return ref
