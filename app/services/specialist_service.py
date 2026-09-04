"""Specialist service providing CRUD, validation, foreign key checks, schedule updates, and OPD slot calculation."""

from datetime import date, datetime, time, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.appointment import Appointment, AppointmentStatus
from app.models.facility import Facility
from app.models.specialist import AvailabilityStatus, Specialist
from app.schemas.specialist import (
    DoctorScheduleUpdate,
    DoctorSlotResponse,
    SpecialistCreate,
    SpecialistUpdate,
)


class SpecialistService:
    """Business logic service for managing medical specialists and availability."""

    @staticmethod
    def create_specialist(db: Session, specialist_in: SpecialistCreate) -> Specialist:
        """Create a new specialist attached to an existing healthcare facility.

        Raises:
            ValueError: If the referenced facility_id does not exist.
        """
        facility = db.query(Facility).filter(Facility.id == specialist_in.facility_id).first()
        if not facility:
            raise ValueError(f"Facility with ID '{specialist_in.facility_id}' does not exist.")

        db_specialist = Specialist(
            id=specialist_in.id or None,
            name=specialist_in.name,
            specialization=specialist_in.specialization,
            department=specialist_in.department or specialist_in.specialization,
            facility_id=specialist_in.facility_id,
            availability_status=specialist_in.availability_status,
            schedule_info=specialist_in.schedule_info,
            opd_start_time=specialist_in.opd_start_time or "09:00",
            opd_end_time=specialist_in.opd_end_time or "17:00",
            slot_duration_minutes=specialist_in.slot_duration_minutes or 15,
            working_days=specialist_in.working_days or "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
            break_start_time=specialist_in.break_start_time or "13:00",
            break_end_time=specialist_in.break_end_time or "14:00",
            is_schedule_active=specialist_in.is_schedule_active if specialist_in.is_schedule_active is not None else True,
            contact_phone=specialist_in.contact_phone,
            contact_email=specialist_in.contact_email,
        )
        db.add(db_specialist)
        db.commit()
        db.refresh(db_specialist)
        return db_specialist

    @staticmethod
    def get_by_id(db: Session, specialist_id: str) -> Optional[Specialist]:
        """Fetch a single specialist by unique identifier."""
        return db.query(Specialist).filter(Specialist.id == specialist_id).first()

    @staticmethod
    def get_specialists(
        db: Session,
        facility_id: Optional[str] = None,
        department: Optional[str] = None,
        specialization: Optional[str] = None,
        availability_status: Optional[AvailabilityStatus] = None,
        is_available_only: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Specialist]:
        """Query specialists with optional filters for facility, department, specialization, and availability."""
        query = db.query(Specialist)

        if facility_id:
            query = query.filter(Specialist.facility_id == facility_id)

        if department:
            dept_term = department.strip()
            query = query.filter(
                (Specialist.department.ilike(f"%{dept_term}%")) |
                (Specialist.specialization.ilike(f"%{dept_term}%"))
            )

        if specialization:
            query = query.filter(Specialist.specialization.ilike(f"%{specialization.strip()}%"))

        if is_available_only:
            query = query.filter(Specialist.availability_status == AvailabilityStatus.AVAILABLE)
        elif availability_status is not None:
            query = query.filter(Specialist.availability_status == availability_status)

        return query.offset(skip).limit(limit).all()

    @staticmethod
    def update_specialist(
        db: Session, specialist_id: str, specialist_in: SpecialistUpdate
    ) -> Optional[Specialist]:
        """Update specialist details, assigned facility, or availability status.

        Raises:
            ValueError: If an updated facility_id does not exist.
        """
        specialist = db.query(Specialist).filter(Specialist.id == specialist_id).first()
        if not specialist:
            return None

        update_dict = specialist_in.model_dump(exclude_unset=True)

        if "facility_id" in update_dict and update_dict["facility_id"] != specialist.facility_id:
            new_fac = db.query(Facility).filter(Facility.id == update_dict["facility_id"]).first()
            if not new_fac:
                raise ValueError(f"Facility with ID '{update_dict['facility_id']}' does not exist.")

        for field, value in update_dict.items():
            setattr(specialist, field, value)

        db.commit()
        db.refresh(specialist)
        return specialist

    @staticmethod
    def update_doctor_schedule(
        db: Session, specialist_id: str, schedule_in: DoctorScheduleUpdate
    ) -> Optional[Specialist]:
        """Update doctor's OPD hours, duration, working days, and break intervals."""
        specialist = db.query(Specialist).filter(Specialist.id == specialist_id).first()
        if not specialist:
            return None

        update_dict = schedule_in.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(specialist, field, value)

        db.commit()
        db.refresh(specialist)
        return specialist

    @staticmethod
    def generate_doctor_slots(
        db: Session, specialist_id: str, target_date: date
    ) -> List[DoctorSlotResponse]:
        """Generate time slots for a doctor on a specific date, indicating availability,

        booked state, lunch break, and working day constraints.
        """
        specialist = db.query(Specialist).filter(Specialist.id == specialist_id).first()
        if not specialist:
            raise ValueError(f"Specialist with ID '{specialist_id}' does not exist.")

        # Check working days
        day_name = target_date.strftime("%A")
        working_days = [d.strip().lower() for d in (specialist.working_days or "").split(",") if d.strip()]
        is_working_day = day_name.lower() in working_days if working_days else True

        # Check schedule active & specialist availability
        schedule_active = bool(specialist.is_schedule_active)
        is_doctor_available = specialist.availability_status == AvailabilityStatus.AVAILABLE

        # Parse OPD hours and intervals
        start_str = specialist.opd_start_time or "09:00"
        end_str = specialist.opd_end_time or "17:00"
        duration = max(specialist.slot_duration_minutes or 15, 5)

        break_start_str = specialist.break_start_time or "13:00"
        break_end_str = specialist.break_end_time or "14:00"

        try:
            start_h, start_m = map(int, start_str.split(":"))
            end_h, end_m = map(int, end_str.split(":"))
            brk_s_h, brk_s_m = map(int, break_start_str.split(":"))
            brk_e_h, brk_e_m = map(int, break_end_str.split(":"))
        except (ValueError, AttributeError):
            start_h, start_m = 9, 0
            end_h, end_m = 17, 0
            brk_s_h, brk_s_m = 13, 0
            brk_e_h, brk_e_m = 14, 0

        start_minutes = start_h * 60 + start_m
        end_minutes = end_h * 60 + end_m
        break_start_minutes = brk_s_h * 60 + brk_s_m
        break_end_minutes = brk_e_h * 60 + brk_e_m

        # Query existing active appointments for this doctor on target_date
        start_dt = datetime.combine(target_date, time.min)
        end_dt = datetime.combine(target_date, time.max)

        existing_appts = (
            db.query(Appointment)
            .filter(
                Appointment.specialist_id == specialist_id,
                Appointment.appointment_date >= start_dt,
                Appointment.appointment_date <= end_dt,
                ~Appointment.status.in_([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
            )
            .all()
        )
        booked_slot_times = {
            appt.slot_start_time for appt in existing_appts if appt.slot_start_time
        }

        slots: List[DoctorSlotResponse] = []
        cur_minutes = start_minutes

        while cur_minutes + duration <= end_minutes:
            slot_s_h, slot_s_m = divmod(cur_minutes, 60)
            slot_e_h, slot_e_m = divmod(cur_minutes + duration, 60)
            slot_start = f"{slot_s_h:02d}:{slot_s_m:02d}"
            slot_end = f"{slot_e_h:02d}:{slot_e_m:02d}"

            # Check if in break
            is_in_break = (
                (cur_minutes >= break_start_minutes and cur_minutes < break_end_minutes)
                or (cur_minutes + duration > break_start_minutes and cur_minutes + duration <= break_end_minutes)
            )

            is_booked = slot_start in booked_slot_times

            if not schedule_active:
                is_avail = False
                reason = "Doctor OPD schedule inactive"
            elif not is_doctor_available:
                is_avail = False
                reason = f"Doctor is {specialist.availability_status.value}"
            elif not is_working_day:
                is_avail = False
                reason = f"Doctor not available on {day_name}"
            elif is_in_break:
                is_avail = False
                reason = "Lunch / OPD Break"
            elif is_booked:
                is_avail = False
                reason = "Already Booked"
            else:
                is_avail = True
                reason = None

            slots.append(
                DoctorSlotResponse(
                    slot_start_time=slot_start,
                    slot_end_time=slot_end,
                    is_available=is_avail,
                    is_booked=is_booked,
                    reason=reason,
                )
            )
            cur_minutes += duration

        return slots

    @staticmethod
    def delete_specialist(db: Session, specialist_id: str) -> bool:
        """Permanently delete a specialist record."""
        specialist = db.query(Specialist).filter(Specialist.id == specialist_id).first()
        if not specialist:
            return False

        db.delete(specialist)
        db.commit()
        return True
