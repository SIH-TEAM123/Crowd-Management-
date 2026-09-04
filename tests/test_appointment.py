"""Tests for Patient Appointments, Sequential Queue Tokens, and OPD Queue Metrics."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.appointment import Appointment, AppointmentStatus
from app.models.facility import Facility, FacilityType
from app.schemas.appointment import AppointmentCreate, AppointmentStatusUpdate
from app.schemas.facility import FacilityCreate
from app.services.appointment_service import AppointmentService
from app.services.facility_service import FacilityService
from app.services.operational_state_service import OperationalStateService

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
def sample_facility(db_session):
    """Create sample hospital facility."""
    return FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_HOSP_01",
            name="District General Hospital",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="1 Civic Center",
            latitude=12.9716,
            longitude=77.5946,
        ),
    )


# =========================================================================
# 1. Appointment Creation & Token Generation
# =========================================================================

def test_appointment_creation_and_sequential_tokens(db_session, sample_facility):
    """Appointments generate sequential queue tokens for the facility."""
    apt1 = AppointmentService.create_appointment(
        db_session,
        AppointmentCreate(
            facility_id=sample_facility.id,
            patient_name="Patient Alpha",
        ),
    )
    apt2 = AppointmentService.create_appointment(
        db_session,
        AppointmentCreate(
            facility_id=sample_facility.id,
            patient_name="Patient Beta",
        ),
    )

    assert apt1.token_number == 1
    assert apt2.token_number == 2
    assert apt1.status == AppointmentStatus.SCHEDULED


def test_appointment_queue_lifecycle_and_metrics(db_session, sample_facility):
    """Test queue metrics when patients are checked in, in consultation, and completed."""
    # Patient 1: In consultation
    apt1 = AppointmentService.create_appointment(
        db_session,
        AppointmentCreate(
            facility_id=sample_facility.id,
            patient_name="Patient 1",
            status=AppointmentStatus.IN_CONSULTATION,
        ),
    )
    # Patient 2: Checked in (waiting)
    apt2 = AppointmentService.create_appointment(
        db_session,
        AppointmentCreate(
            facility_id=sample_facility.id,
            patient_name="Patient 2",
            status=AppointmentStatus.CHECKED_IN,
        ),
    )
    # Patient 3: Scheduled (waiting)
    apt3 = AppointmentService.create_appointment(
        db_session,
        AppointmentCreate(
            facility_id=sample_facility.id,
            patient_name="Patient 3",
            status=AppointmentStatus.SCHEDULED,
        ),
    )

    metrics = AppointmentService.get_facility_queue_metrics(db_session, sample_facility.id)
    assert metrics.queue_length == 2  # 2 waiting (apt2 + apt3)
    assert metrics.current_serving == 1  # 1 in consultation (apt1)
    assert metrics.people_present == 3
    assert metrics.estimated_wait_minutes is not None
    assert metrics.estimated_wait_minutes >= 0.0

    # Complete Patient 2
    AppointmentService.update_appointment_status(
        db_session, apt2.id, AppointmentStatus.COMPLETED
    )

    updated_metrics = AppointmentService.get_facility_queue_metrics(
        db_session, sample_facility.id
    )
    assert updated_metrics.queue_length == 1  # only apt3 remains waiting
    assert updated_metrics.people_present == 2


def test_appointment_queue_feeds_operational_state(db_session, sample_facility):
    """Verify that Appointment records directly populate FacilityOperationalState."""
    AppointmentService.create_appointment(
        db_session,
        AppointmentCreate(
            facility_id=sample_facility.id,
            patient_name="Queue Patient 1",
            status=AppointmentStatus.CHECKED_IN,
        ),
    )
    AppointmentService.create_appointment(
        db_session,
        AppointmentCreate(
            facility_id=sample_facility.id,
            patient_name="Queue Patient 2",
            status=AppointmentStatus.IN_CONSULTATION,
        ),
    )

    state = OperationalStateService.get_facility_operational_state(
        db_session, sample_facility.id
    )

    assert state.queue_length == 1
    assert state.current_serving == 1
    assert state.people_present == 2
    assert state.predicted_wait is not None
    assert state.estimated_wait == state.predicted_wait
    assert state.data_sources["queue"] == "appointment_queue_database"
    assert state.data_sources["prediction"] == "person3_ml_wait_model_v3"


# =========================================================================
# 2. API Endpoints Tests
# =========================================================================

def test_api_appointments_and_queue_endpoint(client, sample_facility):
    """Test API POST /appointments and GET /facilities/{id}/queue."""
    # 1. Create appointment via API
    payload = {
        "facility_id": sample_facility.id,
        "patient_name": "API Patient",
        "department": "General Medicine",
    }
    create_res = client.post("/appointments", json=payload)
    assert create_res.status_code == 201
    assert create_res.json()["token_number"] == 1

    # 2. Check facility queue endpoint
    queue_res = client.get(f"/facilities/{sample_facility.id}/queue")
    assert queue_res.status_code == 200
    data = queue_res.json()
    assert data["queue_length"] == 1
    assert data["people_present"] == 1
