"""Tests for Inter-Facility Referral tracking, relationships, state machine, and API endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.facility import Facility, FacilityType
from app.models.referral import Referral, ReferralPriority, ReferralStatus
from app.schemas.facility import FacilityCreate
from app.schemas.referral import ReferralCreate, ReferralStatusUpdate
from app.services.facility_service import FacilityService
from app.services.referral_service import ReferralService

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
def primary_phc(db_session):
    """Create primary care facility (Source)."""
    return FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_PHC_RURAL",
            name="Rural Sub-District PHC",
            facility_type=FacilityType.PHC,
            address="Village Center 1",
            latitude=12.9716,
            longitude=77.5946,
        ),
    )


@pytest.fixture
def district_hospital(db_session):
    """Create tertiary district hospital (Destination)."""
    return FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_DH_CENTRAL",
            name="Apex District Hospital",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="District Medical Enclave",
            latitude=13.0827,
            longitude=80.2707,
        ),
    )


# =========================================================================
# 1. Referral Creation, Validation, and Relationships
# =========================================================================

def test_valid_referral_creation(db_session, primary_phc, district_hospital):
    """Verify referral creation with full structured requirement fields."""
    ref_in = ReferralCreate(
        id="REF_TEST_01",
        patient_id="PAT_90210",
        patient_name="Ananya Sharma",
        source_facility_id=primary_phc.id,
        destination_facility_id=district_hospital.id,
        reason="Suspected acute cardiac ischemia requiring cath lab",
        required_specialization="Cardiology",
        required_diagnostic="Coronary Angiography",
        required_medicine="Heparin Injection",
        priority=ReferralPriority.EMERGENCY,
        notes="Patient stabilized on oxygen",
    )
    ref = ReferralService.create_referral(db_session, ref_in)

    assert ref.id == "REF_TEST_01"
    assert ref.status == ReferralStatus.CREATED
    assert ref.priority == ReferralPriority.EMERGENCY
    assert ref.source_facility.name == "Rural Sub-District PHC"
    assert ref.destination_facility.name == "Apex District Hospital"
    assert ref.created_at is not None


def test_same_source_and_destination_rejected(db_session, primary_phc):
    """Referral cannot have the same source and destination facility."""
    ref_in = ReferralCreate(
        patient_name="Sunil Dutt",
        source_facility_id=primary_phc.id,
        destination_facility_id=primary_phc.id,  # Same as source
        reason="General checkup",
    )
    with pytest.raises(ValueError, match="cannot be the same"):
        ReferralService.create_referral(db_session, ref_in)


def test_nonexistent_facility_rejected(db_session, primary_phc):
    """Referral with nonexistent facility ID must be rejected."""
    ref_in = ReferralCreate(
        patient_name="Sunil Dutt",
        source_facility_id=primary_phc.id,
        destination_facility_id="NON_EXISTENT_FACILITY_ID",
        reason="Advanced diagnostics",
    )
    with pytest.raises(ValueError, match="does not exist"):
        ReferralService.create_referral(db_session, ref_in)


# =========================================================================
# 2. Lifecycle State Machine & Timestamps Tests
# =========================================================================

def test_referral_lifecycle_valid_progression(db_session, primary_phc, district_hospital):
    """Test full sequential progression: CREATED -> ACCEPTED -> IN_PROGRESS -> COMPLETED."""
    ref = ReferralService.create_referral(
        db_session,
        ReferralCreate(
            id="REF_LIFECYCLE",
            patient_name="Kavita Krishnan",
            source_facility_id=primary_phc.id,
            destination_facility_id=district_hospital.id,
            reason="Orthopedic surgery referral",
            priority=ReferralPriority.URGENT,
        ),
    )
    assert ref.status == ReferralStatus.CREATED

    # 1. CREATED -> ACCEPTED
    ref_acc = ReferralService.update_referral_status(
        db_session, ref.id, ReferralStatus.ACCEPTED, notes="Bed reserved in Ortho ward"
    )
    assert ref_acc.status == ReferralStatus.ACCEPTED
    assert ref_acc.accepted_at is not None

    # 2. ACCEPTED -> IN_PROGRESS
    ref_prog = ReferralService.update_referral_status(
        db_session, ref.id, ReferralStatus.IN_PROGRESS, notes="Patient arrived and admitted"
    )
    assert ref_prog.status == ReferralStatus.IN_PROGRESS
    assert ref_prog.started_at is not None

    # 3. IN_PROGRESS -> COMPLETED
    ref_comp = ReferralService.update_referral_status(
        db_session, ref.id, ReferralStatus.COMPLETED, notes="Surgery completed successfully"
    )
    assert ref_comp.status == ReferralStatus.COMPLETED
    assert ref_comp.completed_at is not None


def test_referral_lifecycle_invalid_jump_rejected(db_session, primary_phc, district_hospital):
    """Direct jump from CREATED to COMPLETED must be rejected."""
    ref = ReferralService.create_referral(
        db_session,
        ReferralCreate(
            patient_name="Direct Jump Test",
            source_facility_id=primary_phc.id,
            destination_facility_id=district_hospital.id,
            reason="Test jump",
        ),
    )
    with pytest.raises(ValueError, match="Invalid state transition"):
        ReferralService.update_referral_status(db_session, ref.id, ReferralStatus.COMPLETED)


def test_terminal_state_protection(db_session, primary_phc, district_hospital):
    """Transitioning out of terminal states (COMPLETED, FAILED, MISSED) must be rejected."""
    ref = ReferralService.create_referral(
        db_session,
        ReferralCreate(
            patient_name="Terminal Test",
            source_facility_id=primary_phc.id,
            destination_facility_id=district_hospital.id,
            reason="Failure test",
        ),
    )
    # Move to FAILED
    ref_failed = ReferralService.update_referral_status(
        db_session, ref.id, ReferralStatus.FAILED, notes="Patient refused transit"
    )
    assert ref_failed.status == ReferralStatus.FAILED
    assert ref_failed.failed_at is not None

    # Attempting to move out of FAILED must fail
    with pytest.raises(ValueError, match="Invalid state transition"):
        ReferralService.update_referral_status(db_session, ref.id, ReferralStatus.ACCEPTED)


# =========================================================================
# 3. Filtering and Multi-Criteria Query Tests
# =========================================================================

def test_filtering_referrals(db_session, primary_phc, district_hospital):
    """Test filtering by source, destination, status, and patient."""
    ReferralService.create_referral(
        db_session,
        ReferralCreate(
            patient_id="PAT_001",
            patient_name="Patient One",
            source_facility_id=primary_phc.id,
            destination_facility_id=district_hospital.id,
            reason="Emergency Care",
            priority=ReferralPriority.EMERGENCY,
        ),
    )
    ReferralService.create_referral(
        db_session,
        ReferralCreate(
            patient_id="PAT_002",
            patient_name="Patient Two",
            source_facility_id=primary_phc.id,
            destination_facility_id=district_hospital.id,
            reason="Routine Check",
            priority=ReferralPriority.ROUTINE,
        ),
    )

    # Filter by priority
    emergencies = ReferralService.get_referrals(db_session, priority=ReferralPriority.EMERGENCY)
    assert len(emergencies) == 1
    assert emergencies[0].patient_id == "PAT_001"

    # Filter by source facility
    source_refs = ReferralService.get_referrals(db_session, source_facility_id=primary_phc.id)
    assert len(source_refs) == 2


# =========================================================================
# 4. API Endpoints & Authorization Tests
# =========================================================================

def test_api_referral_creation_and_status_update(client, primary_phc, district_hospital):
    """Test API POST /referrals and PATCH /referrals/{id}/status lifecycle."""
    headers = {"X-API-Key": "admin-secret-key"}

    # 1. Unauthenticated creation -> 401
    payload = {
        "id": "REF_API_100",
        "patient_name": "Ravi Shastri",
        "source_facility_id": primary_phc.id,
        "destination_facility_id": district_hospital.id,
        "reason": "Neurology consultation",
        "priority": "URGENT",
    }
    assert client.post("/referrals", json=payload).status_code == 401

    # 2. Authenticated creation -> 201
    create_res = client.post("/referrals", json=payload, headers=headers)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["id"] == "REF_API_100"
    assert data["status"] == "CREATED"
    assert data["source_facility_name"] == "Rural Sub-District PHC"
    assert data["destination_facility_name"] == "Apex District Hospital"

    # 3. Advance to ACCEPTED -> 200
    patch_res = client.patch(
        "/referrals/REF_API_100/status",
        json={"status": "ACCEPTED", "notes": "Ambulance dispatched"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "ACCEPTED"
    assert patch_res.json()["accepted_at"] is not None
