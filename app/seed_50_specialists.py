"""
Seed 50 realistic specialist/doctor records for VIZITOR.

Uses SyncSessionLocal because this script is a standalone synchronous seed.
Run from project root:
    python -m app.seed_50_specialists
"""

import random

from app.database import SyncSessionLocal
from app.models.facility import Facility
from app.models.specialist import Specialist, AvailabilityStatus

random.seed(260913)

SPECIALIZATIONS = [
    ("General Medicine", "Medicine"),
    ("Cardiology", "Cardiology"),
    ("Dermatology", "Dermatology"),
    ("Pediatrics", "Pediatrics"),
    ("Gynecology", "Obstetrics & Gynecology"),
    ("Orthopedics", "Orthopedics"),
    ("Neurology", "Neurology"),
    ("Ophthalmology", "Ophthalmology"),
    ("ENT", "ENT"),
    ("Psychiatry", "Mental Health"),
    ("Pulmonology", "Pulmonology"),
    ("Gastroenterology", "Gastroenterology"),
    ("Oncology", "Oncology"),
]

FIRST_NAMES = [
    "Aarav", "Aditya", "Ananya", "Arjun", "Aditi",
    "Bhaskar", "Chandan", "Deepak", "Divya", "Ishita",
    "Karan", "Kavya", "Manish", "Meera", "Neha",
    "Nikhil", "Pallavi", "Pranav", "Priya", "Rahul",
    "Riya", "Rohit", "Sakshi", "Sanjay", "Shreya",
    "Siddharth", "Sneha", "Soumya", "Varun", "Vivek",
]

LAST_NAMES = [
    "Mohanty", "Sahoo", "Das", "Patnaik", "Nayak",
    "Rout", "Behera", "Pradhan", "Jena", "Mishra",
    "Acharya", "Panda", "Swain", "Dutta", "Barik",
]

# These are intentionally randomized demo statuses so the UI filters
# have visible results.
STATUSES = [
    AvailabilityStatus.AVAILABLE,
    AvailabilityStatus.BUSY,
    AvailabilityStatus.ON_LEAVE,
    AvailabilityStatus.UNAVAILABLE,
]

STATUS_WEIGHTS = [45, 25, 15, 15]

DAYS = [
    "Monday,Tuesday,Wednesday,Thursday,Friday",
    "Monday,Tuesday,Wednesday,Thursday,Saturday",
    "Monday,Wednesday,Friday,Saturday",
    "Tuesday,Thursday,Friday,Saturday",
]


def make_phone(index: int) -> str:
    return f"+91 9{700000000 + index:09d}"


def make_email(first: str, last: str, index: int) -> str:
    return f"{first.lower()}.{last.lower()}{index}@vizitor.health"


def main():
    db = SyncSessionLocal()

    try:
        # Remove only previously seeded VIZITOR doctors.
        old_seeded = (
            db.query(Specialist)
            .filter(Specialist.id.like("VIZ_DOC_%"))
            .all()
        )
        for row in old_seeded:
            db.delete(row)

        # Remove the old hospital-as-doctor demo entries.
        old_hospital_demo = (
            db.query(Specialist)
            .filter(
                (Specialist.name.ilike("% Specialist - %"))
                | (Specialist.name.ilike("% Specialist â€“ %"))
                | (Specialist.name.ilike("% Hospital Specialist%"))
            )
            .all()
        )
        for row in old_hospital_demo:
            db.delete(row)

        db.commit()

        facilities = (
            db.query(Facility)
            .filter(Facility.id.like("VIZ_%"), Facility.is_active.is_(True))
            .order_by(Facility.id)
            .all()
        )

        if not facilities:
            raise RuntimeError(
                "No managed VIZITOR facilities found. Run "
                "python -m app.seed_70_facilities first."
            )

        used_names = set()
        doctors = []

        for i in range(1, 51):
            # Guarantee unique names even if random selection repeats.
            while True:
                first = random.choice(FIRST_NAMES)
                last = random.choice(LAST_NAMES)
                full_name = f"Dr. {first} {last}"
                if full_name not in used_names:
                    used_names.add(full_name)
                    break

            specialization, department = random.choice(SPECIALIZATIONS)
            facility = random.choice(facilities)
            status = random.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0]

            start_hour = random.choice([8, 9, 10])
            duration = random.choice([15, 20, 30])
            end_hour = random.choice([16, 17, 18])

            doctor = Specialist(
                id=f"VIZ_DOC_{i:03d}",
                name=full_name,
                specialization=specialization,
                department=department,
                facility_id=facility.id,
                availability_status=status,
                schedule_info=f"OPD {start_hour:02d}:00-{end_hour:02d}:00",
                opd_start_time=f"{start_hour:02d}:00",
opd_end_time=f"{end_hour:02d}:00",
                slot_duration_minutes=duration,
                working_days=random.choice(DAYS),
                break_start_time="13:00",
break_end_time="14:00",
                is_schedule_active=(status != AvailabilityStatus.ON_LEAVE),
                contact_phone=make_phone(i),
                contact_email=make_email(first, last, i),
            )

            db.add(doctor)
            doctors.append(doctor)

        db.commit()

        print(f"SUCCESS: seeded {len(doctors)} doctors.")
        print("Status distribution:")
        for status in STATUSES:
            count = sum(d.availability_status == status for d in doctors)
            print(f"  {status.value}: {count}")

        print("Facilities assigned:", len({d.facility_id for d in doctors}))

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
