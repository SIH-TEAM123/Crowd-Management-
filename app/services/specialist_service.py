"""Specialist service for CRUD, validation, schedule updates, and OPD slots."""

from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.facility import Facility
from app.models.specialist import AvailabilityStatus, Specialist
from app.schemas.specialist import (
    DoctorScheduleUpdate,
    DoctorSlotResponse,
    SpecialistCreate,
    SpecialistUpdate,
)


class SpecialistService:
    """Business logic for managing medical specialists."""

    @staticmethod
    def create_specialist(
        db: Session, specialist_in: SpecialistCreate
    ) -> Specialist:
        facility = (
            db.query(Facility)
            .filter(Facility.id == specialist_in.facility_id)
            .first()
        )

        if not facility:
            raise ValueError(
                f"Facility with ID '{specialist_in.facility_id}' does not exist."
            )

        db_specialist = Specialist(
            id=specialist_in.id or None,
            name=specialist_in.name,
            specialization=specialist_in.specialization,
            department=(
                specialist_in.department
                or specialist_in.specialization
            ),
            facility_id=specialist_in.facility_id,
            availability_status=specialist_in.availability_status,
            schedule_info=specialist_in.schedule_info,
            opd_start_time=specialist_in.opd_start_time or "09:00",
            opd_end_time=specialist_in.opd_end_time or "17:00",
            slot_duration_minutes=(
                specialist_in.slot_duration_minutes or 15
            ),
            working_days=(
                specialist_in.working_days
                or "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday"
            ),
            break_start_time=(
                specialist_in.break_start_time or "13:00"
            ),
            break_end_time=(
                specialist_in.break_end_time or "14:00"
            ),
            is_schedule_active=(
                specialist_in.is_schedule_active
                if specialist_in.is_schedule_active is not None
                else True
            ),
            contact_phone=specialist_in.contact_phone,
            contact_email=specialist_in.contact_email,
        )

        db.add(db_specialist)
        db.commit()
        db.refresh(db_specialist)

        return db_specialist

    @staticmethod
    def get_by_id(
        db: Session, specialist_id: str
    ) -> Optional[Specialist]:
        return (
            db.query(Specialist)
            .filter(Specialist.id == specialist_id)
            .first()
        )

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

        query = db.query(Specialist)

        if facility_id:
            query = query.filter(
                Specialist.facility_id == facility_id
            )

        if department:
            dept_term = department.strip()
            query = query.filter(
                (Specialist.department.ilike(f"%{dept_term}%"))
                | (
                    Specialist.specialization.ilike(
                        f"%{dept_term}%"
                    )
                )
            )

        if specialization:
            query = query.filter(
                Specialist.specialization.ilike(
                    f"%{specialization.strip()}%"
                )
            )

        if is_available_only:
            query = query.filter(
                Specialist.availability_status
                == AvailabilityStatus.AVAILABLE
            )
        elif availability_status is not None:
            query = query.filter(
                Specialist.availability_status
                == availability_status
            )

        return (
            query
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def update_specialist(
        db: Session,
        specialist_id: str,
        specialist_in: SpecialistUpdate,
    ) -> Optional[Specialist]:

        specialist = (
            db.query(Specialist)
            .filter(Specialist.id == specialist_id)
            .first()
        )

        if not specialist:
            return None

        update_dict = specialist_in.model_dump(
            exclude_unset=True
        )

        if (
            "facility_id" in update_dict
            and update_dict["facility_id"]
            != specialist.facility_id
        ):
            new_facility = (
                db.query(Facility)
                .filter(
                    Facility.id
                    == update_dict["facility_id"]
                )
                .first()
            )

            if not new_facility:
                raise ValueError(
                    f"Facility with ID "
                    f"'{update_dict['facility_id']}' "
                    "does not exist."
                )

        for field, value in update_dict.items():
            setattr(specialist, field, value)

        db.commit()
        db.refresh(specialist)

        return specialist

    @staticmethod
    def update_doctor_schedule(
        db: Session,
        specialist_id: str,
        schedule_in: DoctorScheduleUpdate,
    ) -> Optional[Specialist]:

        specialist = (
            db.query(Specialist)
            .filter(Specialist.id == specialist_id)
            .first()
        )

        if not specialist:
            return None

        update_dict = schedule_in.model_dump(
            exclude_unset=True
        )

        for field, value in update_dict.items():
            setattr(specialist, field, value)

        db.commit()
        db.refresh(specialist)

        return specialist

    @staticmethod
    def generate_doctor_slots(
        db: Session,
        specialist_id: str,
        target_date: date,
    ) -> List[DoctorSlotResponse]:

        specialist = (
            db.query(Specialist)
            .filter(Specialist.id == specialist_id)
            .first()
        )

        if not specialist:
            raise ValueError(
                f"Specialist with ID "
                f"'{specialist_id}' does not exist."
            )

        day_name = target_date.strftime("%A")

        working_days = [
            d.strip().lower()
            for d in (
                specialist.working_days or ""
            ).split(",")
            if d.strip()
        ]

        is_working_day = (
            day_name.lower() in working_days
            if working_days
            else True
        )

        schedule_active = bool(
            specialist.is_schedule_active
        )

        is_doctor_available = (
            specialist.availability_status
            == AvailabilityStatus.AVAILABLE
        )

        start_str = specialist.opd_start_time or "09:00"
        end_str = specialist.opd_end_time or "17:00"

        duration = max(
            specialist.slot_duration_minutes or 15,
            5,
        )

        break_start_str = (
            specialist.break_start_time or "13:00"
        )
        break_end_str = (
            specialist.break_end_time or "14:00"
        )

        try:
            start_h, start_m = map(
                int, start_str.split(":")
            )
            end_h, end_m = map(
                int, end_str.split(":")
            )
            brk_s_h, brk_s_m = map(
                int, break_start_str.split(":")
            )
            brk_e_h, brk_e_m = map(
                int, break_end_str.split(":")
            )
        except (ValueError, AttributeError):
            start_h, start_m = 9, 0
            end_h, end_m = 17, 0
            brk_s_h, brk_s_m = 13, 0
            brk_e_h, brk_e_m = 14, 0

        start_minutes = start_h * 60 + start_m
        end_minutes = end_h * 60 + end_m
        break_start_minutes = (
            brk_s_h * 60 + brk_s_m
        )
        break_end_minutes = (
            brk_e_h * 60 + brk_e_m
        )

        slots: List[DoctorSlotResponse] = []

        cur_minutes = start_minutes

        while cur_minutes + duration <= end_minutes:

            slot_s_h, slot_s_m = divmod(
                cur_minutes, 60
            )
            slot_e_h, slot_e_m = divmod(
                cur_minutes + duration,
                60,
            )

            slot_start = (
                f"{slot_s_h:02d}:{slot_s_m:02d}"
            )
            slot_end = (
                f"{slot_e_h:02d}:{slot_e_m:02d}"
            )

            is_in_break = (
                cur_minutes >= break_start_minutes
                and cur_minutes < break_end_minutes
            ) or (
                cur_minutes + duration
                > break_start_minutes
                and cur_minutes + duration
                <= break_end_minutes
            )

            if not schedule_active:
                is_avail = False
                reason = "Doctor OPD schedule inactive"

            elif not is_doctor_available:
                is_avail = False
                reason = (
                    f"Doctor is "
                    f"{specialist.availability_status.value}"
                )

            elif not is_working_day:
                is_avail = False
                reason = (
                    f"Doctor not available on "
                    f"{day_name}"
                )

            elif is_in_break:
                is_avail = False
                reason = "Lunch / OPD Break"

            else:
                is_avail = True
                reason = None

            slots.append(
                DoctorSlotResponse(
                    slot_start_time=slot_start,
                    slot_end_time=slot_end,
                    is_available=is_avail,
                    is_booked=False,
                    reason=reason,
                )
            )

            cur_minutes += duration

        return slots

    @staticmethod
    def delete_specialist(
        db: Session,
        specialist_id: str,
    ) -> bool:

        specialist = (
            db.query(Specialist)
            .filter(Specialist.id == specialist_id)
            .first()
        )

        if not specialist:
            return False

        db.delete(specialist)
        db.commit()

        return True