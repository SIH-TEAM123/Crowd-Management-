"""Appointment and Queue Token Management Service."""

from datetime import datetime, time, timezone
from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.appointment import Appointment, AppointmentStatus
from app.models.facility import Facility
from app.models.specialist import Specialist
from app.schemas.appointment import (
    AppointmentCreate,
    FacilityQueueSummary,
)


class AppointmentService:
    """Service layer managing outpatient appointments, tokens, and active facility queues."""

    @staticmethod
    def create_appointment(db: Session, apt_in: AppointmentCreate) -> Appointment:
        """Book a patient appointment, validate slot availability, and assign the next sequential queue token."""
        facility = db.query(Facility).filter(Facility.id == apt_in.facility_id).first()
        if not facility:
            raise ValueError(f"Facility with ID '{apt_in.facility_id}' does not exist.")

        slot_start = apt_in.slot_start_time.strip() if apt_in.slot_start_time else None
        slot_end = apt_in.slot_end_time.strip() if apt_in.slot_end_time else None

        if apt_in.specialist_id:
            spec = db.query(Specialist).filter(Specialist.id == apt_in.specialist_id).first()
            if not spec:
                raise ValueError(f"Specialist with ID '{apt_in.specialist_id}' does not exist.")
            if spec.facility_id != apt_in.facility_id:
                raise ValueError(
                    f"Specialist '{spec.name}' does not practice at facility '{facility.name}'."
                )

            # If a slot is requested, validate slot conflicts
            if slot_start:
                now_dt = datetime.now(timezone.utc)
                start_dt = datetime.combine(now_dt.date(), time.min)
                end_dt = datetime.combine(now_dt.date(), time.max)

                conflict = (
                    db.query(Appointment)
                    .filter(
                        Appointment.specialist_id == apt_in.specialist_id,
                        Appointment.slot_start_time == slot_start,
                        Appointment.appointment_date >= start_dt,
                        Appointment.appointment_date <= end_dt,
                        ~Appointment.status.in_([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
                    )
                    .first()
                )
                if conflict:
                    raise ValueError(
                        f"Slot '{slot_start}' is already booked for Dr. {spec.name}."
                    )

                if not slot_end:
                    # Calculate end time based on specialist slot_duration_minutes
                    try:
                        sh, sm = map(int, slot_start.split(":"))
                        dur = spec.slot_duration_minutes or 15
                        total_m = sh * 60 + sm + dur
                        eh, em = divmod(total_m, 60)
                        slot_end = f"{eh:02d}:{em:02d}"
                    except Exception:
                        slot_end = slot_start

        # Generate next token number for this facility
        max_token = (
            db.query(func.max(Appointment.token_number))
            .filter(Appointment.facility_id == apt_in.facility_id)
            .scalar()
            or 0
        )
        next_token = max_token + 1

        now = datetime.now(timezone.utc)
        check_in = now if apt_in.status == AppointmentStatus.CHECKED_IN else None
        phone = apt_in.phone_number.strip() if apt_in.phone_number else None

        db_apt = Appointment(
            id=apt_in.id or None,
            facility_id=apt_in.facility_id,
            patient_id=apt_in.patient_id,
            patient_name=apt_in.patient_name,
            phone_number=phone,
            specialist_id=apt_in.specialist_id,
            token_number=next_token,
            status=apt_in.status,
            department=apt_in.department,
            slot_start_time=slot_start,
            slot_end_time=slot_end,
            appointment_date=now,
            check_in_time=check_in,
            notes=apt_in.notes,
        )
        db.add(db_apt)
        db.commit()
        db.refresh(db_apt)

        # Trigger automatic token SMS delivery if phone number is provided
        if db_apt.phone_number:
            try:
                from app.services.sms_service import SMSService
                SMSService.send_token_sms(db, db_apt.id)
            except Exception as sms_err:
                # Failure in SMS transport must NEVER prevent authoritative appointment creation
                import logging
                logging.getLogger(__name__).warning(
                    "Automatic token SMS dispatch failed for appointment %s: %s",
                    db_apt.id,
                    sms_err,
                )

        return db_apt

    @staticmethod
    def get_appointment_by_id(db: Session, appointment_id: str) -> Optional[Appointment]:
        """Fetch appointment by unique ID."""
        return db.query(Appointment).filter(Appointment.id == appointment_id).first()

    @staticmethod
    def get_appointments(
        db: Session,
        facility_id: Optional[str] = None,
        patient_id: Optional[str] = None,
        specialist_id: Optional[str] = None,
        status: Optional[AppointmentStatus] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Appointment]:
        """Query appointments with optional filters."""
        q = db.query(Appointment)
        if facility_id:
            q = q.filter(Appointment.facility_id == facility_id)
        if patient_id:
            q = q.filter(Appointment.patient_id == patient_id)
        if specialist_id:
            q = q.filter(Appointment.specialist_id == specialist_id)
        if status:
            q = q.filter(Appointment.status == status)

        return q.order_by(Appointment.token_number.asc()).offset(skip).limit(limit).all()

    @staticmethod
    def update_appointment_status(
        db: Session,
        appointment_id: str,
        new_status: AppointmentStatus,
        notes: Optional[str] = None,
    ) -> Appointment:
        """Advance appointment state and record event timestamps."""
        apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not apt:
            raise ValueError(f"Appointment with ID '{appointment_id}' not found.")

        now = datetime.now(timezone.utc)
        apt.status = new_status

        if new_status == AppointmentStatus.CHECKED_IN and not apt.check_in_time:
            apt.check_in_time = now
        elif new_status == AppointmentStatus.IN_CONSULTATION and not apt.consultation_start_time:
            apt.consultation_start_time = now
        elif new_status == AppointmentStatus.COMPLETED and not apt.completed_time:
            apt.completed_time = now

        if notes:
            apt.notes = f"{apt.notes or ''}\n{notes}".strip()

        db.commit()
        db.refresh(apt)
        return apt

    @staticmethod
    def get_facility_queue_metrics(db: Session, facility_id: str) -> FacilityQueueSummary:
        """Calculate real queue length, serving count, and estimated wait for a facility."""
        # Waiting in queue
        waiting_count = (
            db.query(Appointment)
            .filter(
                Appointment.facility_id == facility_id,
                Appointment.status.in_(
                    [AppointmentStatus.CHECKED_IN, AppointmentStatus.SCHEDULED]
                ),
            )
            .count()
        )

        # In consultation / serving
        serving_count = (
            db.query(Appointment)
            .filter(
                Appointment.facility_id == facility_id,
                Appointment.status == AppointmentStatus.IN_CONSULTATION,
            )
            .count()
        )

        people_present = waiting_count + serving_count

        # Estimate wait via Person 3 model if queue exists
        estimated_wait: Optional[float] = None
        if waiting_count > 0:
            try:
                from prediction_interface import predict_wait_minutes
                now = datetime.now(timezone.utc)
                pred_wait = predict_wait_minutes(
                    queue_ahead=waiting_count,
                    daily_caller=max(1, waiting_count * 5),
                    hour=now.hour,
                    minute=now.minute,
                    day_of_week=now.weekday(),
                    recent_arrivals=max(1.0, float(waiting_count)),
                    recent_services=max(1.0, float(waiting_count * 0.8)),
                    avg_service_time=200.0,
                    time_since_previous_call=10.0,
                )
                estimated_wait = round(float(pred_wait), 2)
            except Exception:
                estimated_wait = None

        return FacilityQueueSummary(
            facility_id=facility_id,
            queue_length=waiting_count,
            current_serving=serving_count,
            people_present=people_present,
            estimated_wait_minutes=estimated_wait,
        )
