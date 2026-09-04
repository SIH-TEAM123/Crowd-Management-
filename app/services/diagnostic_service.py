from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.facility import Facility
from app.models.diagnostic import (
    BookingStatus,
    DiagnosticBooking,
    DiagnosticTest,
    ResultStatus,
    VALID_BOOKING_TRANSITIONS,
)
from app.schemas.diagnostic import (
    DiagnosticBookingCreate,
    DiagnosticQueueItem,
    DiagnosticQueuePositionResponse,
    DiagnosticQueueSummary,
    DiagnosticTestCreate,
    DiagnosticTestUpdate,
)


class DiagnosticService:
    """Business logic service for managing diagnostic tests, facility availability, and booking state transitions."""

    # -------------------------------------------------------------------------
    # Diagnostic Test Catalog Operations
    # -------------------------------------------------------------------------

    @staticmethod
    def create_diagnostic(db: Session, diag_in: DiagnosticTestCreate) -> DiagnosticTest:
        """Register a new diagnostic test at a facility.

        Raises:
            ValueError: If referenced facility_id does not exist.
        """
        facility = db.query(Facility).filter(Facility.id == diag_in.facility_id).first()
        if not facility:
            raise ValueError(f"Facility with ID '{diag_in.facility_id}' does not exist.")

        db_diag = DiagnosticTest(
            id=diag_in.id or None,
            name=diag_in.name,
            category=diag_in.category,
            facility_id=diag_in.facility_id,
            is_available=diag_in.is_available,
            description=diag_in.description,
            cost=diag_in.cost,
            estimated_duration_minutes=diag_in.estimated_duration_minutes,
        )
        db.add(db_diag)
        db.commit()
        db.refresh(db_diag)
        return db_diag

    @staticmethod
    def get_diagnostic_by_id(db: Session, diagnostic_id: str) -> Optional[DiagnosticTest]:
        """Retrieve diagnostic test by ID."""
        return db.query(DiagnosticTest).filter(DiagnosticTest.id == diagnostic_id).first()

    @staticmethod
    def get_diagnostics(
        db: Session,
        facility_id: Optional[str] = None,
        name: Optional[str] = None,
        category: Optional[str] = None,
        is_available_only: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> List[DiagnosticTest]:
        """Query diagnostic tests with filters."""
        query = db.query(DiagnosticTest)

        if facility_id:
            query = query.filter(DiagnosticTest.facility_id == facility_id)

        if name:
            query = query.filter(DiagnosticTest.name.ilike(f"%{name.strip()}%"))

        if category:
            query = query.filter(DiagnosticTest.category.ilike(f"%{category.strip()}%"))

        if is_available_only:
            query = query.filter(DiagnosticTest.is_available.is_(True))

        return query.offset(skip).limit(limit).all()

    @staticmethod
    def check_availability(
        db: Session, facility_id: str, test_name: str
    ) -> Tuple[bool, Optional[DiagnosticTest]]:
        """Determine whether a specific test name is currently available at a given facility."""
        diag = (
            db.query(DiagnosticTest)
            .filter(
                DiagnosticTest.facility_id == facility_id,
                DiagnosticTest.name.ilike(f"%{test_name.strip()}%"),
                DiagnosticTest.is_available.is_(True),
            )
            .first()
        )
        return (diag is not None), diag

    @staticmethod
    def update_diagnostic(
        db: Session, diagnostic_id: str, diag_in: DiagnosticTestUpdate
    ) -> Optional[DiagnosticTest]:
        """Update an existing diagnostic test."""
        diag = db.query(DiagnosticTest).filter(DiagnosticTest.id == diagnostic_id).first()
        if not diag:
            return None

        update_dict = diag_in.model_dump(exclude_unset=True)

        if "facility_id" in update_dict and update_dict["facility_id"] != diag.facility_id:
            new_fac = db.query(Facility).filter(Facility.id == update_dict["facility_id"]).first()
            if not new_fac:
                raise ValueError(f"Facility with ID '{update_dict['facility_id']}' does not exist.")

        for field, value in update_dict.items():
            setattr(diag, field, value)

        db.commit()
        db.refresh(diag)
        return diag

    @staticmethod
    def delete_diagnostic(db: Session, diagnostic_id: str) -> bool:
        """Remove a diagnostic test from the facility catalog."""
        diag = db.query(DiagnosticTest).filter(DiagnosticTest.id == diagnostic_id).first()
        if not diag:
            return False

        db.delete(diag)
        db.commit()
        return True

    # -------------------------------------------------------------------------
    # Diagnostic Booking & Lifecycle State Machine Operations
    # -------------------------------------------------------------------------

    @staticmethod
    def create_booking(db: Session, booking_in: DiagnosticBookingCreate) -> DiagnosticBooking:
        """Create a new diagnostic booking.

        Validates:
        1. Facility exists.
        2. Diagnostic test exists and belongs to specified facility.
        3. Diagnostic test is currently marked as available.

        Raises:
            ValueError: If facility/test does not exist or test is unavailable.
        """
        facility = db.query(Facility).filter(Facility.id == booking_in.facility_id).first()
        if not facility:
            raise ValueError(f"Facility with ID '{booking_in.facility_id}' does not exist.")

        diag = db.query(DiagnosticTest).filter(DiagnosticTest.id == booking_in.diagnostic_id).first()
        if not diag:
            raise ValueError(f"Diagnostic test with ID '{booking_in.diagnostic_id}' does not exist.")

        if diag.facility_id != booking_in.facility_id:
            raise ValueError(
                f"Diagnostic test '{diag.name}' is not offered at facility '{facility.name}'."
            )

        if not diag.is_available:
            raise ValueError(
                f"Diagnostic test '{diag.name}' is currently unavailable at facility '{facility.name}'."
            )

        now = datetime.now(timezone.utc)
        result_stat = booking_in.result_status or ResultStatus.PENDING
        res_time = now if result_stat == ResultStatus.AVAILABLE else None

        db_booking = DiagnosticBooking(
            id=booking_in.id or None,
            diagnostic_id=booking_in.diagnostic_id,
            facility_id=booking_in.facility_id,
            patient_id=booking_in.patient_id,
            patient_name=booking_in.patient_name,
            status=booking_in.status,
            result_status=result_stat,
            booking_time=now,
            result_available_time=res_time,
            notes=booking_in.notes,
        )
        db.add(db_booking)
        db.commit()
        db.refresh(db_booking)
        return db_booking

    @staticmethod
    def get_booking_by_id(db: Session, booking_id: str) -> Optional[DiagnosticBooking]:
        """Fetch booking by ID."""
        return db.query(DiagnosticBooking).filter(DiagnosticBooking.id == booking_id).first()

    @staticmethod
    def get_bookings(
        db: Session,
        facility_id: Optional[str] = None,
        diagnostic_id: Optional[str] = None,
        patient_id: Optional[str] = None,
        status: Optional[BookingStatus] = None,
        result_status: Optional[ResultStatus] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[DiagnosticBooking]:
        """Query bookings with optional filters."""
        query = db.query(DiagnosticBooking)

        if facility_id:
            query = query.filter(DiagnosticBooking.facility_id == facility_id)

        if diagnostic_id:
            query = query.filter(DiagnosticBooking.diagnostic_id == diagnostic_id)

        if patient_id:
            query = query.filter(DiagnosticBooking.patient_id == patient_id)

        if status:
            query = query.filter(DiagnosticBooking.status == status)

        if result_status:
            query = query.filter(DiagnosticBooking.result_status == result_status)

        return query.order_by(DiagnosticBooking.booking_time.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def update_booking_status(
        db: Session, booking_id: str, new_status: BookingStatus, notes: Optional[str] = None
    ) -> DiagnosticBooking:
        """Transition booking to target lifecycle state using formal state machine validation.

        Lifecycle:
            REQUESTED -> BOOKED -> IN_PROGRESS -> COMPLETED
            (and CANCELLED / FAILED from active states)

        Raises:
            ValueError: On invalid or disallowed state transitions.
        """
        booking = db.query(DiagnosticBooking).filter(DiagnosticBooking.id == booking_id).first()
        if not booking:
            raise ValueError(f"Diagnostic booking with ID '{booking_id}' not found.")

        current_status = booking.status

        # Allow idempotency if target status is the same
        if current_status == new_status:
            if notes:
                booking.notes = f"{booking.notes or ''}\n{notes}".strip()
                db.commit()
                db.refresh(booking)
            return booking

        # Validate transition
        allowed_next_states = VALID_BOOKING_TRANSITIONS.get(current_status, set())
        if new_status not in allowed_next_states:
            raise ValueError(
                f"Invalid state transition: Cannot transition booking '{booking_id}' "
                f"from '{current_status.value}' to '{new_status.value}'."
            )

        now = datetime.now(timezone.utc)
        booking.status = new_status

        if new_status == BookingStatus.IN_PROGRESS:
            booking.in_progress_time = now
        elif new_status == BookingStatus.COMPLETED:
            booking.completed_time = now
        elif new_status in (BookingStatus.CANCELLED, BookingStatus.FAILED):
            booking.cancelled_time = now

        if notes:
            booking.notes = f"{booking.notes or ''}\n[{now.isoformat()}] {notes}".strip()

        db.commit()
        db.refresh(booking)
        return booking

    @staticmethod
    def update_result_status(
        db: Session,
        booking_id: str,
        result_status: ResultStatus,
        notes: Optional[str] = None,
    ) -> DiagnosticBooking:
        """Update result availability status independently of booking lifecycle state.

        Distinguishes:
            PENDING: Result is pending / not yet available.
            AVAILABLE: Result is generated and ready for retrieval.
        """
        booking = db.query(DiagnosticBooking).filter(DiagnosticBooking.id == booking_id).first()
        if not booking:
            raise ValueError(f"Diagnostic booking with ID '{booking_id}' not found.")

        now = datetime.now(timezone.utc)
        booking.result_status = result_status

        if result_status == ResultStatus.AVAILABLE and not booking.result_available_time:
            booking.result_available_time = now
        elif result_status == ResultStatus.PENDING:
            booking.result_available_time = None

        if notes:
            booking.notes = f"{booking.notes or ''}\n[{now.isoformat()}] [Result: {result_status.value}] {notes}".strip()

        db.commit()
        db.refresh(booking)
        return booking

    # -------------------------------------------------------------------------
    # Diagnostic Queue Calculations & Metrics
    # -------------------------------------------------------------------------

    @staticmethod
    def calculate_queue_position(db: Session, booking: DiagnosticBooking) -> Optional[int]:
        """Compute the deterministic 1-based queue position for an active diagnostic booking.

        Queue Definition:
            - Bookings in REQUESTED or BOOKED states are actively waiting in queue (1, 2, 3...).
            - Bookings in IN_PROGRESS are currently being served (position 0).
            - Bookings in COMPLETED, CANCELLED, or FAILED are outside the queue (None).
            - Ordering is deterministic based on booking_time ASC, then id ASC.
        """
        if booking.status in (BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.FAILED):
            return None

        if booking.status == BookingStatus.IN_PROGRESS:
            return 0

        if booking.status in (BookingStatus.REQUESTED, BookingStatus.BOOKED):
            ahead_count = (
                db.query(DiagnosticBooking)
                .filter(
                    DiagnosticBooking.diagnostic_id == booking.diagnostic_id,
                    DiagnosticBooking.status.in_([BookingStatus.REQUESTED, BookingStatus.BOOKED]),
                    or_(
                        DiagnosticBooking.booking_time < booking.booking_time,
                        and_(
                            DiagnosticBooking.booking_time == booking.booking_time,
                            DiagnosticBooking.id < booking.id,
                        ),
                    ),
                )
                .count()
            )
            return ahead_count + 1

        return None

    @staticmethod
    def get_booking_queue_position(
        db: Session, booking_id: str
    ) -> Optional[DiagnosticQueuePositionResponse]:
        """Retrieve real-time queue position and estimated wait for a specific booking."""
        booking = db.query(DiagnosticBooking).filter(DiagnosticBooking.id == booking_id).first()
        if not booking:
            return None

        q_pos = DiagnosticService.calculate_queue_position(db, booking)
        diag = booking.diagnostic

        people_ahead = None
        est_wait = None

        if q_pos is not None:
            if q_pos == 0:
                people_ahead = 0
                est_wait = 0.0
            elif q_pos > 0:
                people_ahead = q_pos - 1
                unit_duration = float(diag.estimated_duration_minutes or 15) if diag else 15.0
                est_wait = round(people_ahead * unit_duration, 2)

        return DiagnosticQueuePositionResponse(
            booking_id=booking.id,
            diagnostic_id=booking.diagnostic_id,
            diagnostic_name=diag.name if diag else None,
            facility_id=booking.facility_id,
            facility_name=booking.facility.name if booking.facility else None,
            patient_name=booking.patient_name,
            status=booking.status,
            result_status=booking.result_status,
            queue_position=q_pos,
            people_ahead=people_ahead,
            estimated_wait_minutes=est_wait,
        )

    @staticmethod
    def get_diagnostic_queue(db: Session, diagnostic_id: str) -> Optional[DiagnosticQueueSummary]:
        """Fetch the active queue summary and deterministic queued bookings for a diagnostic test."""
        diag = db.query(DiagnosticTest).filter(DiagnosticTest.id == diagnostic_id).first()
        if not diag:
            return None

        active_bookings = (
            db.query(DiagnosticBooking)
            .filter(
                DiagnosticBooking.diagnostic_id == diagnostic_id,
                DiagnosticBooking.status.in_(
                    [BookingStatus.REQUESTED, BookingStatus.BOOKED, BookingStatus.IN_PROGRESS]
                ),
            )
            .order_by(DiagnosticBooking.booking_time.asc(), DiagnosticBooking.id.asc())
            .all()
        )

        waiting_items: List[DiagnosticQueueItem] = []
        in_progress_count = 0
        current_waiting_rank = 1

        unit_duration = float(diag.estimated_duration_minutes or 15)

        for b in active_bookings:
            if b.status == BookingStatus.IN_PROGRESS:
                in_progress_count += 1
                waiting_items.append(
                    DiagnosticQueueItem(
                        booking_id=b.id,
                        patient_name=b.patient_name,
                        patient_id=b.patient_id,
                        status=b.status,
                        result_status=b.result_status,
                        queue_position=0,
                        booking_time=b.booking_time,
                        estimated_wait_minutes=0.0,
                    )
                )
            elif b.status in (BookingStatus.REQUESTED, BookingStatus.BOOKED):
                est_wait = round((current_waiting_rank - 1) * unit_duration, 2)
                waiting_items.append(
                    DiagnosticQueueItem(
                        booking_id=b.id,
                        patient_name=b.patient_name,
                        patient_id=b.patient_id,
                        status=b.status,
                        result_status=b.result_status,
                        queue_position=current_waiting_rank,
                        booking_time=b.booking_time,
                        estimated_wait_minutes=est_wait,
                    )
                )
                current_waiting_rank += 1

        waiting_count = current_waiting_rank - 1
        total_active = waiting_count + in_progress_count
        overall_est_wait = round(waiting_count * unit_duration, 2) if waiting_count > 0 else 0.0

        return DiagnosticQueueSummary(
            facility_id=diag.facility_id,
            facility_name=diag.facility.name if diag.facility else None,
            diagnostic_id=diag.id,
            diagnostic_name=diag.name,
            waiting_count=waiting_count,
            in_progress_count=in_progress_count,
            total_active=total_active,
            estimated_wait_minutes=overall_est_wait,
            queue=waiting_items,
        )

    @staticmethod
    def get_facility_diagnostic_queues(
        db: Session, facility_id: str
    ) -> List[DiagnosticQueueSummary]:
        """Fetch queues for all diagnostic tests offered at a specific facility."""
        tests = db.query(DiagnosticTest).filter(DiagnosticTest.facility_id == facility_id).all()
        summaries: List[DiagnosticQueueSummary] = []
        for test in tests:
            summary = DiagnosticService.get_diagnostic_queue(db, test.id)
            if summary:
                summaries.append(summary)
        return summaries
