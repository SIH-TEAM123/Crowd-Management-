"""Tests for Specialist entity, relationships, availability filtering, and API routes."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.facility import Facility, FacilityType
from app.models.specialist import AvailabilityStatus, Specialist
from app.schemas.facility import FacilityCreate
from app.schemas.specialist import SpecialistCreate, SpecialistUpdate
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
def sample_facility(db_session):
    """Create and return a sample healthcare facility for specialist attachment."""
    facility_in = FacilityCreate(
        id="FAC_GENERAL_01",
        name="General District Hospital",
        facility_type=FacilityType.DISTRICT_HOSPITAL,
        address="100 Hospital Boulevard",
        latitude=12.9716,
        longitude=77.5946,
        contact_phone="080-12345678",
    )
    return FacilityService.create_facility(db_session, facility_in)


# =========================================================================
# 1. Specialist Model & Schema Validation Tests
# =========================================================================

def test_availability_status_enum():
    """Verify all required availability status enum values."""
    assert AvailabilityStatus.AVAILABLE.value == "AVAILABLE"
    assert AvailabilityStatus.UNAVAILABLE.value == "UNAVAILABLE"
    assert AvailabilityStatus.ON_LEAVE.value == "ON_LEAVE"
    assert AvailabilityStatus.BUSY.value == "BUSY"


def test_specialist_create_valid_schema(sample_facility):
    """Valid specialist payload creates schema cleanly."""
    payload = SpecialistCreate(
        id="SPEC_001",
        name="Dr. Sarah Rao",
        specialization="Cardiology",
        facility_id=sample_facility.id,
        availability_status=AvailabilityStatus.AVAILABLE,
        schedule_info="Mon-Fri 09:00 - 13:00",
        contact_phone="+91-9876543210",
        contact_email="sarah.rao@hospital.gov.in",
    )
    assert payload.name == "Dr. Sarah Rao"
    assert payload.specialization == "Cardiology"
    assert payload.availability_status == AvailabilityStatus.AVAILABLE


def test_specialist_empty_name_or_specialization_rejected():
    """Empty or whitespace strings must be rejected."""
    with pytest.raises(ValueError):
        SpecialistCreate(
            name="   ",
            specialization="Cardiology",
            facility_id="FAC_GENERAL_01",
        )

    with pytest.raises(ValueError):
        SpecialistCreate(
            name="Dr. Valid Name",
            specialization="",
            facility_id="FAC_GENERAL_01",
        )


# =========================================================================
# 2. Service Layer & Database Relationship Tests
# =========================================================================

def test_specialist_facility_relationship(db_session, sample_facility):
    """Test relationship between Specialist and Facility."""
    s1 = SpecialistCreate(
        id="SPEC_REL_01",
        name="Dr. Arun Kumar",
        specialization="Pediatrics",
        facility_id=sample_facility.id,
        availability_status=AvailabilityStatus.AVAILABLE,
    )
    created = SpecialistService.create_specialist(db_session, s1)
    assert created.facility.id == sample_facility.id
    assert created.facility.name == "General District Hospital"

    # Verify back-reference from facility
    db_session.refresh(sample_facility)
    assert len(sample_facility.specialists) == 1
    assert sample_facility.specialists[0].name == "Dr. Arun Kumar"


def test_specialist_invalid_facility_rejected(db_session):
    """Specialist referencing non-existent facility must raise ValueError."""
    s_invalid = SpecialistCreate(
        name="Dr. Ghost",
        specialization="Neurology",
        facility_id="NON_EXISTENT_FACILITY_ID",
    )
    with pytest.raises(ValueError, match="does not exist"):
        SpecialistService.create_specialist(db_session, s_invalid)


def test_specialist_filter_by_facility_and_specialization(db_session, sample_facility):
    """Test filtering specialists by facility and specialization."""
    # Create second facility
    f2 = FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_PHC_02",
            name="Rural PHC Hub",
            facility_type=FacilityType.PHC,
            address="Rural Sector 4",
            latitude=13.0,
            longitude=77.6,
        ),
    )

    SpecialistService.create_specialist(
        db_session,
        SpecialistCreate(
            name="Dr. A",
            specialization="Cardiology",
            facility_id=sample_facility.id,
            availability_status=AvailabilityStatus.AVAILABLE,
        ),
    )
    SpecialistService.create_specialist(
        db_session,
        SpecialistCreate(
            name="Dr. B",
            specialization="Pediatrics",
            facility_id=sample_facility.id,
            availability_status=AvailabilityStatus.ON_LEAVE,
        ),
    )
    SpecialistService.create_specialist(
        db_session,
        SpecialistCreate(
            name="Dr. C",
            specialization="Cardiology",
            facility_id=f2.id,
            availability_status=AvailabilityStatus.AVAILABLE,
        ),
    )

    # Filter by facility
    fac1_specialists = SpecialistService.get_specialists(db_session, facility_id=sample_facility.id)
    assert len(fac1_specialists) == 2

    # Filter by specialization
    cardio_specialists = SpecialistService.get_specialists(db_session, specialization="Cardiology")
    assert len(cardio_specialists) == 2

    # Filter by availability
    available_specialists = SpecialistService.get_specialists(db_session, is_available_only=True)
    assert len(available_specialists) == 2


# =========================================================================
# 3. API Route & Authorization Tests
# =========================================================================

def test_api_list_specialists_empty(client):
    """GET /specialists returns empty list initially."""
    response = client.get("/specialists")
    assert response.status_code == 200
    assert response.json() == []


def test_api_create_specialist_protected_without_auth(client, sample_facility):
    """POST /specialists without credentials returns 401 Unauthorized."""
    payload = {
        "name": "Dr. Unauth",
        "specialization": "Orthopedics",
        "facility_id": sample_facility.id,
    }
    response = client.post("/specialists", json=payload)
    assert response.status_code == 401


def test_api_create_specialist_with_auth(client, sample_facility):
    """POST /specialists with valid X-API-Key creates specialist."""
    headers = {"X-API-Key": "admin-secret-key"}
    payload = {
        "id": "SPEC_API_01",
        "name": "Dr. Priya Sharma",
        "specialization": "Orthopedics",
        "facility_id": sample_facility.id,
        "availability_status": "AVAILABLE",
        "schedule_info": "Mon, Wed, Fri 10:00 - 14:00",
    }
    response = client.post("/specialists", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "SPEC_API_01"
    assert data["name"] == "Dr. Priya Sharma"
    assert data["facility_name"] == "General District Hospital"

    # Get single specialist
    get_res = client.get("/specialists/SPEC_API_01")
    assert get_res.status_code == 200
    assert get_res.json()["specialization"] == "Orthopedics"


def test_api_create_specialist_invalid_facility_returns_400(client):
    """POST /specialists with invalid facility ID returns 400 Bad Request."""
    headers = {"X-API-Key": "admin-secret-key"}
    payload = {
        "name": "Dr. Invalid",
        "specialization": "Dermatology",
        "facility_id": "NON_EXISTENT_FAC",
    }
    response = client.post("/specialists", json=payload, headers=headers)
    assert response.status_code == 400
    assert "does not exist" in response.json()["detail"].lower()


def test_api_available_specialists_endpoint(client, sample_facility):
    """GET /specialists/available returns only available specialists."""
    headers = {"X-API-Key": "admin-secret-key"}
    s1 = {
        "id": "SPEC_AVAIL_1",
        "name": "Dr. Available",
        "specialization": "General Surgery",
        "facility_id": sample_facility.id,
        "availability_status": "AVAILABLE",
    }
    s2 = {
        "id": "SPEC_UNAVAIL_2",
        "name": "Dr. Unavailable",
        "specialization": "General Surgery",
        "facility_id": sample_facility.id,
        "availability_status": "ON_LEAVE",
    }
    client.post("/specialists", json=s1, headers=headers)
    client.post("/specialists", json=s2, headers=headers)

    res = client.get("/specialists/available")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == "SPEC_AVAIL_1"


def test_api_update_specialist_status(client, sample_facility):
    """PUT /specialists/{id} updates availability status."""
    headers = {"Authorization": "Bearer operator-secret-key"}
    s1 = {
        "id": "SPEC_UPDATE_1",
        "name": "Dr. Update Test",
        "specialization": "ENT",
        "facility_id": sample_facility.id,
        "availability_status": "AVAILABLE",
    }
    client.post("/specialists", json=s1, headers=headers)

    # Update status to BUSY
    update_res = client.put(
        "/specialists/SPEC_UPDATE_1",
        json={"availability_status": "BUSY", "schedule_info": "In Surgery"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["availability_status"] == "BUSY"
    assert update_res.json()["schedule_info"] == "In Surgery"


def test_api_delete_specialist(client, sample_facility):
    """DELETE /specialists/{id} removes specialist."""
    headers = {"X-API-Key": "admin-secret-key"}
    s1 = {
        "id": "SPEC_DEL_1",
        "name": "Dr. Delete Test",
        "specialization": "Oncology",
        "facility_id": sample_facility.id,
    }
    client.post("/specialists", json=s1, headers=headers)

    del_res = client.delete("/specialists/SPEC_DEL_1", headers=headers)
    assert del_res.status_code == 200

    # Verify 404 on subsequent get
    assert client.get("/specialists/SPEC_DEL_1").status_code == 404
