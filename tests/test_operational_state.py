"""Tests for Unified Facility Operational State and Live Camera Telemetry Integration."""

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.facility import Facility, FacilityType
from app.models.specialist import AvailabilityStatus, Specialist
from app.models.diagnostic import BookingStatus, DiagnosticBooking, DiagnosticTest
from app.models.medicine import FacilityInventory, Medicine
from app.models.referral import Referral, ReferralPriority, ReferralStatus
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.diagnostic import DiagnosticBookingCreate, DiagnosticTestCreate
from app.schemas.facility import FacilityCreate
from app.schemas.medicine import FacilityInventoryCreate, MedicineCreate
from app.schemas.operational_state import CameraTelemetryPublish
from app.schemas.referral import ReferralCreate
from app.schemas.specialist import SpecialistCreate
from app.services.diagnostic_service import DiagnosticService
from app.services.facility_service import FacilityService
from app.services.medicine_service import MedicineService
from app.services.operational_state_service import OperationalStateService
from app.services.referral_service import ReferralService
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
    """Create fresh database tables before each test, clear telemetry registries, and drop tables after."""
    Base.metadata.create_all(bind=test_engine)
    OperationalStateService.clear_camera_telemetry()
    OperationalStateService.clear_emergency_telemetry()
    yield
    Base.metadata.drop_all(bind=test_engine)
    OperationalStateService.clear_camera_telemetry()
    OperationalStateService.clear_emergency_telemetry()


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
def test_facility(db_session):
    """Create a primary test hospital facility."""
    return FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_METRO_01",
            name="Metro Multi-Specialty Hospital",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="100 Metro Health Plaza",
            latitude=12.9716,
            longitude=77.5946,
        ),
    )


@pytest.fixture
def secondary_facility(db_session):
    """Create a secondary rural facility."""
    return FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_RURAL_02",
            name="Rural Sub-District Health Center",
            facility_type=FacilityType.RURAL_HOSPITAL,
            address="45 Rural Way",
            latitude=13.0500,
            longitude=77.6000,
        ),
    )


# =========================================================================
# 1. Operational State Aggregation Tests
# =========================================================================

def test_facility_operational_state_baseline_nulls(db_session, test_facility):
    """A newly created facility without telemetry or queue should strictly return NULL for crowd, wait, capacity."""
    state = OperationalStateService.get_facility_operational_state(db_session, test_facility.id)

    assert state.facility_id == "FAC_METRO_01"
    assert state.facility_name == "Metro Multi-Specialty Hospital"
    assert state.facility_type == "DISTRICT_HOSPITAL"
    assert state.is_active is True

    # Real nulls
    assert state.current_crowd is None
    assert state.queue_length is None
    assert state.predicted_wait is None
    assert state.service_capacity is None
    assert state.emergency_load is None

    # Real database zeroes
    assert state.specialists_total == 0
    assert state.specialists_available == 0
    assert state.diagnostics_total == 0
    assert state.diagnostics_available == 0
    assert state.medicines_in_stock == 0
    assert state.medicines_out_of_stock == 0
    assert state.referrals_in_progress == 0


def test_unknown_facility_raises_not_found(db_session):
    """Querying an unknown facility ID must raise ValueError (or HTTP 404 in API)."""
    with pytest.raises(ValueError, match="not found"):
        OperationalStateService.get_facility_operational_state(
            db_session, "NON_EXISTENT_FACILITY"
        )


def test_specialist_counts(db_session, test_facility):
    """Verify specialist totals and available counts are accurately aggregated."""
    # 2 available, 1 on leave
    SpecialistService.create_specialist(
        db_session,
        SpecialistCreate(
            name="Dr. A",
            specialization="Cardiology",
            facility_id=test_facility.id,
            availability_status=AvailabilityStatus.AVAILABLE,
        ),
    )
    SpecialistService.create_specialist(
        db_session,
        SpecialistCreate(
            name="Dr. B",
            specialization="Neurology",
            facility_id=test_facility.id,
            availability_status=AvailabilityStatus.AVAILABLE,
        ),
    )
    SpecialistService.create_specialist(
        db_session,
        SpecialistCreate(
            name="Dr. C",
            specialization="Orthopedics",
            facility_id=test_facility.id,
            availability_status=AvailabilityStatus.ON_LEAVE,
        ),
    )

    state = OperationalStateService.get_facility_operational_state(db_session, test_facility.id)
    assert state.specialists_total == 3
    assert state.specialists_available == 2


def test_diagnostic_counts(db_session, test_facility):
    """Verify diagnostic total and available counts."""
    # 1 available, 1 unavailable
    DiagnosticService.create_diagnostic(
        db_session,
        DiagnosticTestCreate(
            name="MRI",
            facility_id=test_facility.id,
            is_available=True,
        ),
    )
    DiagnosticService.create_diagnostic(
        db_session,
        DiagnosticTestCreate(
            name="CT Scan",
            facility_id=test_facility.id,
            is_available=False,
        ),
    )

    state = OperationalStateService.get_facility_operational_state(db_session, test_facility.id)
    assert state.diagnostics_total == 2
    assert state.diagnostics_available == 1


def test_medicine_inventory_counts(db_session, test_facility):
    """Verify in-stock (qty > 0) vs out-of-stock (qty == 0) counts."""
    med1 = MedicineService.create_medicine(db_session, MedicineCreate(name="Med1"))
    med2 = MedicineService.create_medicine(db_session, MedicineCreate(name="Med2"))

    # Med1: 50 in stock, Med2: 0 out of stock
    MedicineService.set_or_update_inventory(
        db_session,
        FacilityInventoryCreate(
            facility_id=test_facility.id,
            medicine_id=med1.id,
            quantity=50,
        ),
    )
    MedicineService.set_or_update_inventory(
        db_session,
        FacilityInventoryCreate(
            facility_id=test_facility.id,
            medicine_id=med2.id,
            quantity=0,
        ),
    )

    state = OperationalStateService.get_facility_operational_state(db_session, test_facility.id)
    assert state.medicines_in_stock == 1
    assert state.medicines_out_of_stock == 1


def test_referral_counts(db_session, test_facility, secondary_facility):
    """Verify in-progress and incoming/outgoing referral tracking."""
    # Create referral in progress
    ref = ReferralService.create_referral(
        db_session,
        ReferralCreate(
            patient_name="Patient Ref",
            source_facility_id=test_facility.id,
            destination_facility_id=secondary_facility.id,
            reason="Transfer",
        ),
    )
    ReferralService.update_referral_status(db_session, ref.id, ReferralStatus.ACCEPTED)
    ReferralService.update_referral_status(db_session, ref.id, ReferralStatus.IN_PROGRESS)

    state = OperationalStateService.get_facility_operational_state(db_session, test_facility.id)
    assert state.referrals_in_progress == 1
    assert state.referrals_outgoing == 1


def test_queue_and_prediction_from_real_bookings(db_session, test_facility):
    """When real bookings exist in DB, queue_length and predicted_wait are populated."""
    diag = DiagnosticService.create_diagnostic(
        db_session,
        DiagnosticTestCreate(
            name="Blood Test",
            facility_id=test_facility.id,
            is_available=True,
        ),
    )
    # Create 3 active bookings
    for i in range(3):
        DiagnosticService.create_booking(
            db_session,
            DiagnosticBookingCreate(
                diagnostic_id=diag.id,
                facility_id=test_facility.id,
                patient_name=f"Patient {i}",
            ),
        )

    state = OperationalStateService.get_facility_operational_state(db_session, test_facility.id)
    assert state.queue_length == 3
    assert state.predicted_wait is not None
    assert state.predicted_wait >= 0.0
    assert "person3_ml_wait_model_v3" in state.data_sources.values()


def test_queue_and_prediction_from_real_appointments(db_session, test_facility):
    """When real outpatient appointments exist in DB, appointment queue is the primary source."""
    from app.schemas.appointment import AppointmentCreate
    from app.services.appointment_service import AppointmentService

    # 2 Waiting (1 Scheduled, 1 Checked in), 1 In consultation
    AppointmentService.create_appointment(
        db_session,
        AppointmentCreate(
            facility_id=test_facility.id,
            patient_name="Apt Patient 1",
            status=AppointmentStatus.SCHEDULED,
        ),
    )
    AppointmentService.create_appointment(
        db_session,
        AppointmentCreate(
            facility_id=test_facility.id,
            patient_name="Apt Patient 2",
            status=AppointmentStatus.CHECKED_IN,
        ),
    )
    AppointmentService.create_appointment(
        db_session,
        AppointmentCreate(
            facility_id=test_facility.id,
            patient_name="Apt Patient 3",
            status=AppointmentStatus.IN_CONSULTATION,
        ),
    )

    state = OperationalStateService.get_facility_operational_state(db_session, test_facility.id)
    assert state.queue_length == 2
    assert state.current_serving == 1
    assert state.people_present == 3
    assert state.predicted_wait is not None
    assert state.data_sources["queue"] == "appointment_queue_database"
    assert state.data_sources["prediction"] == "person3_ml_wait_model_v3"


def test_camera_telemetry_integration(db_session, test_facility):
    """Publishing camera telemetry updates current_crowd with privacy sanitization."""
    OperationalStateService.publish_camera_telemetry(
        facility_id=test_facility.id,
        telemetry_in=CameraTelemetryPublish(
            camera_id="CAM_LOBBY_01",
            people_count=14,
            location_type="waiting_room",
        ),
    )

    state = OperationalStateService.get_facility_operational_state(db_session, test_facility.id)
    assert state.current_crowd == 14
    assert state.data_sources["camera"] == "live_camera_telemetry"


# =========================================================================
# 2. API Endpoints & Authorization Tests
# =========================================================================

def test_api_get_facility_operational_state(client, test_facility):
    """GET /facilities/{id}/operational-state returns complete state."""
    res = client.get(f"/facilities/{test_facility.id}/operational-state")
    assert res.status_code == 200
    data = res.json()
    assert data["facility_id"] == test_facility.id
    assert data["facility_name"] == test_facility.name
    assert "data_sources" in data


def test_api_get_facility_operational_state_404(client):
    """GET /facilities/NON_EXISTENT/operational-state returns 404."""
    res = client.get("/facilities/NON_EXISTENT/operational-state")
    assert res.status_code == 404


def test_api_get_all_operational_states(client, test_facility, secondary_facility):
    """GET /facilities/operational-state returns all facilities."""
    res = client.get("/facilities/operational-state")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2


def test_api_publish_camera_telemetry_protected(client, test_facility):
    """POST /facilities/{id}/camera-telemetry requires operator/admin auth."""
    payload = {
        "camera_id": "CAM_MAIN",
        "people_count": 8,
    }
    # Unauthenticated -> 401
    assert client.post(f"/facilities/{test_facility.id}/camera-telemetry", json=payload).status_code == 401

    # Authenticated -> 201
    headers = {"X-API-Key": "operator-secret-key"}
    res = client.post(
        f"/facilities/{test_facility.id}/camera-telemetry",
        json=payload,
        headers=headers,
    )
    assert res.status_code == 201
    assert res.json()["people_count"] == 8
