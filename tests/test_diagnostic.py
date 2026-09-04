"""Tests for Diagnostic Test catalog, Availability Checking, and Booking Lifecycle State Machine."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.diagnostic import BookingStatus, DiagnosticBooking, DiagnosticTest, ResultStatus
from app.models.facility import Facility, FacilityType
from app.schemas.diagnostic import (
    DiagnosticBookingCreate,
    DiagnosticBookingResultStatusUpdate,
    DiagnosticBookingStatusUpdate,
    DiagnosticTestCreate,
    DiagnosticTestUpdate,
)
from app.schemas.facility import FacilityCreate
from app.services.diagnostic_service import DiagnosticService
from app.services.facility_service import FacilityService

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
    """Create and return a sample healthcare facility."""
    return FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_DIAG_01",
            name="Apex Diagnostic Center",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="45 Health Hub Way",
            latitude=12.9716,
            longitude=77.5946,
        ),
    )


@pytest.fixture
def sample_diagnostic(db_session, sample_facility):
    """Create and return a sample available diagnostic test."""
    return DiagnosticService.create_diagnostic(
        db_session,
        DiagnosticTestCreate(
            id="DIAG_CBC_01",
            name="Complete Blood Count (CBC)",
            category="Pathology",
            facility_id=sample_facility.id,
            is_available=True,
            cost=350.0,
            estimated_duration_minutes=30,
        ),
    )


# =========================================================================
# 1. Diagnostic Test Catalog & Facility Relationship Tests
# =========================================================================

def test_diagnostic_facility_relationship(db_session, sample_facility, sample_diagnostic):
    """Verify diagnostic foreign key and bi-directional relationship with facility."""
    assert sample_diagnostic.facility.id == sample_facility.id
    assert sample_diagnostic.facility.name == "Apex Diagnostic Center"

    db_session.refresh(sample_facility)
    assert len(sample_facility.diagnostics) == 1
    assert sample_facility.diagnostics[0].name == "Complete Blood Count (CBC)"


def test_diagnostic_invalid_facility_rejected(db_session):
    """Registering diagnostic with non-existent facility must raise ValueError."""
    with pytest.raises(ValueError, match="does not exist"):
        DiagnosticService.create_diagnostic(
            db_session,
            DiagnosticTestCreate(
                name="MRI Brain",
                facility_id="NON_EXISTENT_FACILITY",
            ),
        )


def test_check_availability(db_session, sample_facility, sample_diagnostic):
    """Test availability lookup for a given facility and test name."""
    is_avail, diag = DiagnosticService.check_availability(
        db_session, sample_facility.id, "Complete Blood Count"
    )
    assert is_avail is True
    assert diag.id == sample_diagnostic.id

    # Check non-existent test
    is_avail_none, diag_none = DiagnosticService.check_availability(
        db_session, sample_facility.id, "Non-Existent Test"
    )
    assert is_avail_none is False
    assert diag_none is None


# =========================================================================
# 2. Diagnostic Booking & Lifecycle State Machine Tests
# =========================================================================

def test_booking_creation_valid(db_session, sample_facility, sample_diagnostic):
    """Test successful booking creation."""
    booking_in = DiagnosticBookingCreate(
        id="BKG_001",
        diagnostic_id=sample_diagnostic.id,
        facility_id=sample_facility.id,
        patient_id="PAT_123",
        patient_name="Rahul Verma",
        notes="Fasting required",
    )
    booking = DiagnosticService.create_booking(db_session, booking_in)

    assert booking.id == "BKG_001"
    assert booking.status == BookingStatus.REQUESTED
    assert booking.diagnostic.name == "Complete Blood Count (CBC)"
    assert booking.facility.name == "Apex Diagnostic Center"
    assert booking.booking_time is not None


def test_booking_unavailable_test_rejected(db_session, sample_facility):
    """Booking an unavailable diagnostic test must raise ValueError."""
    # Create an unavailable test
    unavail_diag = DiagnosticService.create_diagnostic(
        db_session,
        DiagnosticTestCreate(
            id="DIAG_UNAVAIL",
            name="CT Scan",
            facility_id=sample_facility.id,
            is_available=False,
        ),
    )

    booking_in = DiagnosticBookingCreate(
        diagnostic_id=unavail_diag.id,
        facility_id=sample_facility.id,
        patient_name="Anita Roy",
    )
    with pytest.raises(ValueError, match="currently unavailable"):
        DiagnosticService.create_booking(db_session, booking_in)


def test_booking_lifecycle_valid_transitions(db_session, sample_facility, sample_diagnostic):
    """Test valid sequential progression: REQUESTED -> BOOKED -> IN_PROGRESS -> COMPLETED."""
    booking_in = DiagnosticBookingCreate(
        id="BKG_LIFECYCLE",
        diagnostic_id=sample_diagnostic.id,
        facility_id=sample_facility.id,
        patient_name="Suresh Nair",
    )
    booking = DiagnosticService.create_booking(db_session, booking_in)
    assert booking.status == BookingStatus.REQUESTED

    # 1. REQUESTED -> BOOKED
    b_booked = DiagnosticService.update_booking_status(
        db_session, booking.id, BookingStatus.BOOKED, notes="Slot confirmed for 10:30 AM"
    )
    assert b_booked.status == BookingStatus.BOOKED

    # 2. BOOKED -> IN_PROGRESS
    b_progress = DiagnosticService.update_booking_status(
        db_session, booking.id, BookingStatus.IN_PROGRESS, notes="Sample collected"
    )
    assert b_progress.status == BookingStatus.IN_PROGRESS
    assert b_progress.in_progress_time is not None

    # 3. IN_PROGRESS -> COMPLETED
    b_completed = DiagnosticService.update_booking_status(
        db_session, booking.id, BookingStatus.COMPLETED, notes="Report generated"
    )
    assert b_completed.status == BookingStatus.COMPLETED
    assert b_completed.completed_time is not None


def test_booking_lifecycle_invalid_transition_rejected(db_session, sample_facility, sample_diagnostic):
    """Test invalid state transition rejection (e.g. REQUESTED -> COMPLETED)."""
    booking = DiagnosticService.create_booking(
        db_session,
        DiagnosticBookingCreate(
            diagnostic_id=sample_diagnostic.id,
            facility_id=sample_facility.id,
            patient_name="Meena Kumari",
        ),
    )
    # Direct jump from REQUESTED to COMPLETED is disallowed
    with pytest.raises(ValueError, match="Invalid state transition"):
        DiagnosticService.update_booking_status(db_session, booking.id, BookingStatus.COMPLETED)


def test_booking_cancellation_and_terminal_state(db_session, sample_facility, sample_diagnostic):
    """Test cancellation path and rejection of transitions from terminal state."""
    booking = DiagnosticService.create_booking(
        db_session,
        DiagnosticBookingCreate(
            diagnostic_id=sample_diagnostic.id,
            facility_id=sample_facility.id,
            patient_name="Vikram Singh",
        ),
    )
    # Cancel booking
    b_cancelled = DiagnosticService.update_booking_status(
        db_session, booking.id, BookingStatus.CANCELLED, notes="Patient requested cancellation"
    )
    assert b_cancelled.status == BookingStatus.CANCELLED
    assert b_cancelled.cancelled_time is not None

    # Attempting to move out of CANCELLED state must be rejected
    with pytest.raises(ValueError, match="Invalid state transition"):
        DiagnosticService.update_booking_status(db_session, booking.id, BookingStatus.IN_PROGRESS)


# =========================================================================
# 3. API Endpoints & Authorization Tests
# =========================================================================

def test_api_list_diagnostics(client, sample_diagnostic):
    """GET /diagnostics returns test catalog."""
    res = client.get("/diagnostics")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["name"] == "Complete Blood Count (CBC)"
    assert data[0]["facility_name"] == "Apex Diagnostic Center"


def test_api_check_availability_endpoint(client, sample_facility, sample_diagnostic):
    """GET /diagnostics/check-availability verifies test presence and availability."""
    res = client.get(
        f"/diagnostics/check-availability?facility_id={sample_facility.id}&test_name=Complete+Blood"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["available"] is True
    assert data["diagnostic"]["id"] == sample_diagnostic.id


def test_api_create_diagnostic_protected_route(client, sample_facility):
    """POST /diagnostics requires authentication."""
    payload = {
        "name": "Lipid Profile",
        "facility_id": sample_facility.id,
    }
    # Unauthenticated
    assert client.post("/diagnostics", json=payload).status_code == 401

    # Authenticated
    headers = {"X-API-Key": "admin-secret-key"}
    res = client.post("/diagnostics", json=payload, headers=headers)
    assert res.status_code == 201
    assert res.json()["name"] == "Lipid Profile"


def test_api_booking_flow_and_status_patch(client, sample_facility, sample_diagnostic):
    """Test booking creation via API and subsequent state transition via PATCH."""
    # 1. Create booking
    booking_payload = {
        "id": "BKG_API_01",
        "diagnostic_id": sample_diagnostic.id,
        "facility_id": sample_facility.id,
        "patient_name": "Rohan Das",
    }
    create_res = client.post("/diagnostics/bookings", json=booking_payload)
    assert create_res.status_code == 201
    assert create_res.json()["status"] == "REQUESTED"
    assert create_res.json()["result_status"] == "PENDING"
    assert create_res.json()["queue_position"] == 1

    # 2. Transition status (Requires Operator/Admin auth)
    headers = {"Authorization": "Bearer operator-secret-key"}
    patch_payload = {
        "status": "BOOKED",
        "notes": "Appointment scheduled for 11:00 AM",
    }
    patch_res = client.patch(
        "/diagnostics/bookings/BKG_API_01/status", json=patch_payload, headers=headers
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "BOOKED"
    assert patch_res.json()["queue_position"] == 1


# =========================================================================
# 4. Diagnostic Queue & Deterministic Ordering Tests
# =========================================================================

def test_deterministic_queue_positions_multiple_bookings(db_session, sample_facility, sample_diagnostic):
    """Multiple real bookings produce deterministic, sequential queue positions."""
    b1 = DiagnosticService.create_booking(
        db_session,
        DiagnosticBookingCreate(
            id="BKG_Q_01",
            diagnostic_id=sample_diagnostic.id,
            facility_id=sample_facility.id,
            patient_name="Patient One",
        ),
    )
    b2 = DiagnosticService.create_booking(
        db_session,
        DiagnosticBookingCreate(
            id="BKG_Q_02",
            diagnostic_id=sample_diagnostic.id,
            facility_id=sample_facility.id,
            patient_name="Patient Two",
        ),
    )
    b3 = DiagnosticService.create_booking(
        db_session,
        DiagnosticBookingCreate(
            id="BKG_Q_03",
            diagnostic_id=sample_diagnostic.id,
            facility_id=sample_facility.id,
            patient_name="Patient Three",
        ),
    )

    pos1 = DiagnosticService.calculate_queue_position(db_session, b1)
    pos2 = DiagnosticService.calculate_queue_position(db_session, b2)
    pos3 = DiagnosticService.calculate_queue_position(db_session, b3)

    assert pos1 == 1
    assert pos2 == 2
    assert pos3 == 3

    # Check diagnostic queue summary
    queue_summary = DiagnosticService.get_diagnostic_queue(db_session, sample_diagnostic.id)
    assert queue_summary.waiting_count == 3
    assert queue_summary.in_progress_count == 0
    assert queue_summary.total_active == 3
    assert len(queue_summary.queue) == 3
    assert queue_summary.queue[0].queue_position == 1
    assert queue_summary.queue[0].booking_id == "BKG_Q_01"
    assert queue_summary.queue[1].queue_position == 2
    assert queue_summary.queue[1].booking_id == "BKG_Q_02"
    assert queue_summary.queue[2].queue_position == 3
    assert queue_summary.queue[2].booking_id == "BKG_Q_03"


def test_queue_position_updates_on_lifecycle_transitions(db_session, sample_facility, sample_diagnostic):
    """Queue positions recalculate dynamically as bookings move to IN_PROGRESS, COMPLETED, or CANCELLED."""
    b1 = DiagnosticService.create_booking(
        db_session,
        DiagnosticBookingCreate(
            id="BKG_TR_01",
            diagnostic_id=sample_diagnostic.id,
            facility_id=sample_facility.id,
            patient_name="Alpha",
        ),
    )
    b2 = DiagnosticService.create_booking(
        db_session,
        DiagnosticBookingCreate(
            id="BKG_TR_02",
            diagnostic_id=sample_diagnostic.id,
            facility_id=sample_facility.id,
            patient_name="Beta",
        ),
    )
    b3 = DiagnosticService.create_booking(
        db_session,
        DiagnosticBookingCreate(
            id="BKG_TR_03",
            diagnostic_id=sample_diagnostic.id,
            facility_id=sample_facility.id,
            patient_name="Gamma",
        ),
    )

    # 1. Advance b1 to BOOKED, then IN_PROGRESS
    DiagnosticService.update_booking_status(db_session, b1.id, BookingStatus.BOOKED)
    DiagnosticService.update_booking_status(db_session, b1.id, BookingStatus.IN_PROGRESS)

    # b1 is currently being served (position 0)
    assert DiagnosticService.calculate_queue_position(db_session, b1) == 0
    # b2 is now 1st in waiting queue
    assert DiagnosticService.calculate_queue_position(db_session, b2) == 1
    # b3 is 2nd in waiting queue
    assert DiagnosticService.calculate_queue_position(db_session, b3) == 2

    # 2. Cancel b2
    DiagnosticService.update_booking_status(db_session, b2.id, BookingStatus.CANCELLED)
    # b2 is no longer in queue (None)
    assert DiagnosticService.calculate_queue_position(db_session, b2) is None
    # b3 advances to position 1
    assert DiagnosticService.calculate_queue_position(db_session, b3) == 1

    # 3. Complete b1
    DiagnosticService.update_booking_status(db_session, b1.id, BookingStatus.COMPLETED)
    # b1 is completed (None)
    assert DiagnosticService.calculate_queue_position(db_session, b1) is None
    # b3 remains position 1
    assert DiagnosticService.calculate_queue_position(db_session, b3) == 1

    # Check queue summary
    summary = DiagnosticService.get_diagnostic_queue(db_session, sample_diagnostic.id)
    assert summary.waiting_count == 1
    assert summary.in_progress_count == 0
    assert summary.total_active == 1
    assert summary.queue[0].booking_id == "BKG_TR_03"


# =========================================================================
# 5. Diagnostic Result Status Tests
# =========================================================================

def test_result_status_independent_of_booking_status(db_session, sample_facility, sample_diagnostic):
    """Result status is tracked independently of booking execution lifecycle."""
    b = DiagnosticService.create_booking(
        db_session,
        DiagnosticBookingCreate(
            id="BKG_RES_01",
            diagnostic_id=sample_diagnostic.id,
            facility_id=sample_facility.id,
            patient_name="Priya Sharma",
        ),
    )
    # Initial result status is PENDING
    assert b.result_status == ResultStatus.PENDING
    assert b.result_available_time is None

    # Progress through lifecycle: REQUESTED -> BOOKED -> IN_PROGRESS -> COMPLETED
    DiagnosticService.update_booking_status(db_session, b.id, BookingStatus.BOOKED)
    db_session.refresh(b)
    assert b.result_status == ResultStatus.PENDING

    DiagnosticService.update_booking_status(db_session, b.id, BookingStatus.IN_PROGRESS)
    db_session.refresh(b)
    assert b.result_status == ResultStatus.PENDING

    # Mark result available while still in progress (e.g. preliminary test result available)
    b_updated = DiagnosticService.update_result_status(
        db_session, b.id, ResultStatus.AVAILABLE, notes="Rapid test kit output verified"
    )
    assert b_updated.result_status == ResultStatus.AVAILABLE
    assert b_updated.result_available_time is not None
    assert b_updated.status == BookingStatus.IN_PROGRESS

    # Complete booking; result status remains AVAILABLE
    DiagnosticService.update_booking_status(db_session, b.id, BookingStatus.COMPLETED)
    db_session.refresh(b)
    assert b.status == BookingStatus.COMPLETED
    assert b.result_status == ResultStatus.AVAILABLE


def test_result_status_update_after_booking_completed(db_session, sample_facility, sample_diagnostic):
    """Lab results can be released after booking has been completed."""
    b = DiagnosticService.create_booking(
        db_session,
        DiagnosticBookingCreate(
            id="BKG_RES_02",
            diagnostic_id=sample_diagnostic.id,
            facility_id=sample_facility.id,
            patient_name="Arjun Patel",
        ),
    )
    DiagnosticService.update_booking_status(db_session, b.id, BookingStatus.BOOKED)
    DiagnosticService.update_booking_status(db_session, b.id, BookingStatus.IN_PROGRESS)
    DiagnosticService.update_booking_status(db_session, b.id, BookingStatus.COMPLETED)

    db_session.refresh(b)
    assert b.status == BookingStatus.COMPLETED
    assert b.result_status == ResultStatus.PENDING
    assert b.result_available_time is None

    # Later, lab results become available
    b_res = DiagnosticService.update_result_status(
        db_session, b.id, ResultStatus.AVAILABLE, notes="Pathology report finalized and signed off"
    )
    assert b_res.result_status == ResultStatus.AVAILABLE
    assert b_res.result_available_time is not None
    assert "Pathology report finalized" in b_res.notes


# =========================================================================
# 6. Queue & Result Status API Endpoints Tests
# =========================================================================

def test_api_queue_endpoints(client, sample_facility, sample_diagnostic):
    """Test GET /diagnostics/{id}/queue, GET /diagnostics/facilities/{id}/queue, and booking queue-position."""
    # Create 2 bookings
    b1_payload = {
        "id": "BKG_API_Q1",
        "diagnostic_id": sample_diagnostic.id,
        "facility_id": sample_facility.id,
        "patient_name": "API Patient 1",
    }
    b2_payload = {
        "id": "BKG_API_Q2",
        "diagnostic_id": sample_diagnostic.id,
        "facility_id": sample_facility.id,
        "patient_name": "API Patient 2",
    }
    client.post("/diagnostics/bookings", json=b1_payload)
    client.post("/diagnostics/bookings", json=b2_payload)

    # 1. Test-level queue endpoint
    diag_q_res = client.get(f"/diagnostics/{sample_diagnostic.id}/queue")
    assert diag_q_res.status_code == 200
    diag_q_data = diag_q_res.json()
    assert diag_q_data["diagnostic_id"] == sample_diagnostic.id
    assert diag_q_data["waiting_count"] == 2
    assert diag_q_data["total_active"] == 2
    assert len(diag_q_data["queue"]) == 2
    assert diag_q_data["queue"][0]["queue_position"] == 1
    assert diag_q_data["queue"][1]["queue_position"] == 2

    # 2. Facility-level queue endpoint
    fac_q_res = client.get(f"/diagnostics/facilities/{sample_facility.id}/queue")
    assert fac_q_res.status_code == 200
    fac_q_data = fac_q_res.json()
    assert len(fac_q_data) == 1
    assert fac_q_data[0]["facility_id"] == sample_facility.id
    assert fac_q_data[0]["waiting_count"] == 2

    # 3. Single booking queue position endpoint
    pos_res = client.get("/diagnostics/bookings/BKG_API_Q2/queue-position")
    assert pos_res.status_code == 200
    pos_data = pos_res.json()
    assert pos_data["booking_id"] == "BKG_API_Q2"
    assert pos_data["queue_position"] == 2
    assert pos_data["people_ahead"] == 1
    assert pos_data["estimated_wait_minutes"] == 30.0  # 1 ahead * 30 min


def test_api_result_status_patch_and_filtering(client, sample_facility, sample_diagnostic):
    """Test PATCH /diagnostics/bookings/{id}/result-status and result_status query filtering."""
    # Create booking
    b_payload = {
        "id": "BKG_API_RES",
        "diagnostic_id": sample_diagnostic.id,
        "facility_id": sample_facility.id,
        "patient_name": "API Patient Result",
    }
    client.post("/diagnostics/bookings", json=b_payload)

    # PATCH result status (unauthenticated -> 401)
    patch_payload = {
        "result_status": "AVAILABLE",
        "notes": "Blood report attached and ready",
    }
    unauth_res = client.patch("/diagnostics/bookings/BKG_API_RES/result-status", json=patch_payload)
    assert unauth_res.status_code == 401

    # PATCH result status (authenticated -> 200)
    headers = {"X-API-Key": "admin-secret-key"}
    auth_res = client.patch(
        "/diagnostics/bookings/BKG_API_RES/result-status", json=patch_payload, headers=headers
    )
    assert auth_res.status_code == 200
    data = auth_res.json()
    assert data["result_status"] == "AVAILABLE"
    assert data["result_available_time"] is not None

    # Filter bookings by result_status
    res_avail = client.get("/diagnostics/bookings/list?result_status=AVAILABLE")
    assert res_avail.status_code == 200
    assert any(b["id"] == "BKG_API_RES" for b in res_avail.json())

    res_pend = client.get("/diagnostics/bookings/list?result_status=PENDING")
    assert res_pend.status_code == 200
    assert not any(b["id"] == "BKG_API_RES" for b in res_pend.json())
