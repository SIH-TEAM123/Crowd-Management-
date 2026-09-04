"""Tests for OPD Departments, Doctor OPD Slot Management, and Double-Booking Prevention."""

from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.appointment import Appointment, AppointmentStatus
from app.models.department import Department
from app.models.facility import Facility, FacilityType
from app.models.specialist import AvailabilityStatus, Specialist
from app.schemas.appointment import AppointmentCreate
from app.schemas.department import DepartmentCreate
from app.schemas.facility import FacilityCreate
from app.schemas.specialist import SpecialistCreate
from app.services.appointment_service import AppointmentService
from app.services.department_service import DepartmentService
from app.services.facility_service import FacilityService
from app.services.specialist_service import SpecialistService

# Set up test in-memory SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_database():
    """Create fresh database tables before each test and drop them after."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    """Provide a transactional database session for tests."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db_session):
    """Provide FastAPI test client with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_headers():
    return {"Authorization": "Bearer admin-secret-key"}


@pytest.fixture
def sample_facility(db_session):
    return FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_TEST_01",
            name="Apex General Hospital",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="100 Main Road",
            latitude=12.97,
            longitude=77.59,
        ),
    )


@pytest.fixture
def sample_doctor(db_session, sample_facility):
    return SpecialistService.create_specialist(
        db_session,
        SpecialistCreate(
            id="DOC_CARDIO_01",
            name="Dr. Sarah Sharma",
            specialization="Cardiology",
            department="Cardiology",
            facility_id=sample_facility.id,
            opd_start_time="09:00",
            opd_end_time="11:00",
            slot_duration_minutes=30,
            working_days="Monday,Tuesday,Wednesday,Thursday,Friday",
            break_start_time="10:00",
            break_end_time="10:30",
            is_schedule_active=True,
        ),
    )


# =========================================================================
# 1. Department CRUD & Auto-Discovery Tests
# =========================================================================

def test_department_creation_and_listing(client, sample_facility, admin_headers):
    # 1. Create department
    res = client.post(
        f"/facilities/{sample_facility.id}/departments",
        json={
            "facility_id": sample_facility.id,
            "name": "Orthopedics",
            "description": "Bone and joint care",
        },
        headers=admin_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Orthopedics"
    assert data["facility_id"] == sample_facility.id

    # 2. List facility departments
    list_res = client.get(f"/facilities/{sample_facility.id}/departments")
    assert list_res.status_code == 200
    depts = list_res.json()
    assert len(depts) >= 1
    assert any(d["name"] == "Orthopedics" for d in depts)


def test_department_auto_discovery_from_specialists(client, sample_facility, sample_doctor):
    # Department list should automatically include Cardiology from sample_doctor
    res = client.get(f"/facilities/{sample_facility.id}/departments")
    assert res.status_code == 200
    depts = res.json()
    names = [d["name"] for d in depts]
    assert "Cardiology" in names


# =========================================================================
# 2. Doctor Schedule & Slot Generation Tests
# =========================================================================

def test_doctor_slots_generation_and_lunch_break(client, sample_doctor):
    # Find next Monday to test working day
    today = date.today()
    days_ahead = (0 - today.weekday()) % 7  # Monday = 0
    if days_ahead == 0:
        days_ahead = 7
    next_monday = today + timedelta(days=days_ahead)
    date_str = next_monday.strftime("%Y-%m-%d")

    res = client.get(f"/specialists/{sample_doctor.id}/slots?date={date_str}")
    assert res.status_code == 200
    slots = res.json()

    # Total OPD 09:00 - 11:00 with 30m slots:
    # 09:00-09:30 (Avail), 09:30-10:00 (Avail), 10:00-10:30 (Break), 10:30-11:00 (Avail)
    assert len(slots) == 4
    assert slots[0]["slot_start_time"] == "09:00"
    assert slots[0]["is_available"] is True

    assert slots[1]["slot_start_time"] == "09:30"
    assert slots[1]["is_available"] is True

    assert slots[2]["slot_start_time"] == "10:00"
    assert slots[2]["is_available"] is False
    assert "break" in (slots[2]["reason"] or "").lower()

    assert slots[3]["slot_start_time"] == "10:30"
    assert slots[3]["is_available"] is True


def test_doctor_slots_non_working_day(client, sample_doctor):
    # Find next Sunday (sample_doctor works Mon-Fri)
    today = date.today()
    days_ahead = (6 - today.weekday()) % 7  # Sunday = 6
    if days_ahead == 0:
        days_ahead = 7
    next_sunday = today + timedelta(days=days_ahead)
    date_str = next_sunday.strftime("%Y-%m-%d")

    res = client.get(f"/specialists/{sample_doctor.id}/slots?date={date_str}")
    assert res.status_code == 200
    slots = res.json()
    assert len(slots) == 4
    # All slots should be unavailable due to non-working day
    for s in slots:
        assert s["is_available"] is False
        assert "not available" in s["reason"].lower() or "sunday" in s["reason"].lower()


def test_update_doctor_schedule(client, sample_doctor, admin_headers):
    # Update schedule to 10:00 - 12:00, 20m slots
    res = client.put(
        f"/specialists/{sample_doctor.id}/schedule",
        json={
            "opd_start_time": "10:00",
            "opd_end_time": "12:00",
            "slot_duration_minutes": 20,
        },
        headers=admin_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["opd_start_time"] == "10:00"
    assert data["slot_duration_minutes"] == 20


# =========================================================================
# 3. Appointment Slot Booking & Conflict Prevention
# =========================================================================

def test_appointment_booking_with_slot_and_double_booking_prevention(client, sample_facility, sample_doctor):
    today_str = date.today().strftime("%Y-%m-%d")

    # 1. Book first appointment for 09:00 slot
    res1 = client.post(
        "/appointments",
        json={
            "facility_id": sample_facility.id,
            "patient_name": "Patient One",
            "department": "Cardiology",
            "specialist_id": sample_doctor.id,
            "slot_start_time": "09:00",
        },
    )
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["slot_start_time"] == "09:00"
    assert data1["slot_end_time"] == "09:30"
    assert data1["token_number"] == 1

    # 2. Check slots list - 09:00 should be marked booked
    slot_res = client.get(f"/specialists/{sample_doctor.id}/slots?date={today_str}")
    assert slot_res.status_code == 200
    slots = slot_res.json()
    slot_9am = next(s for s in slots if s["slot_start_time"] == "09:00")
    assert slot_9am["is_available"] is False
    assert slot_9am["is_booked"] is True

    # 3. Try to book the same slot again -> 409 Conflict
    res2 = client.post(
        "/appointments",
        json={
            "facility_id": sample_facility.id,
            "patient_name": "Patient Two",
            "department": "Cardiology",
            "specialist_id": sample_doctor.id,
            "slot_start_time": "09:00",
        },
    )
    assert res2.status_code == 409
    assert "already booked" in res2.json()["detail"].lower()

    # 4. Book another available slot 09:30 -> succeeds
    res3 = client.post(
        "/appointments",
        json={
            "facility_id": sample_facility.id,
            "patient_name": "Patient Three",
            "department": "Cardiology",
            "specialist_id": sample_doctor.id,
            "slot_start_time": "09:30",
        },
    )
    assert res3.status_code == 201
    assert res3.json()["token_number"] == 2


def test_cancelled_appointment_frees_slot(client, sample_facility, sample_doctor, admin_headers):
    today_str = date.today().strftime("%Y-%m-%d")

    # 1. Book 09:00 slot
    res = client.post(
        "/appointments",
        json={
            "facility_id": sample_facility.id,
            "patient_name": "Patient Cancel Test",
            "specialist_id": sample_doctor.id,
            "slot_start_time": "09:00",
        },
    )
    assert res.status_code == 201
    apt_id = res.json()["id"]

    # 2. Cancel appointment
    cancel_res = client.patch(
        f"/appointments/{apt_id}/status",
        json={"status": "CANCELLED", "notes": "Patient requested cancellation"},
        headers=admin_headers,
    )
    assert cancel_res.status_code == 200

    # 3. 09:00 slot should now be bookable again
    res2 = client.post(
        "/appointments",
        json={
            "facility_id": sample_facility.id,
            "patient_name": "New Patient Rebooking",
            "specialist_id": sample_doctor.id,
            "slot_start_time": "09:00",
        },
    )
    assert res2.status_code == 201
    assert res2.json()["token_number"] == 2
