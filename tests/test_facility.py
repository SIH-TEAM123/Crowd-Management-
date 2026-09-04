"""Tests for Facility models, schemas, Haversine calculations, service layer, and FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.facility import Facility, FacilityType
from app.schemas.facility import FacilityCreate, FacilityUpdate
from app.services.facility_service import FacilityService, calculate_haversine_distance

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


# =========================================================================
# 1. Haversine Distance Calculation Tests
# =========================================================================

def test_haversine_same_point():
    """Distance between identical coordinates must be 0."""
    dist = calculate_haversine_distance(12.9716, 77.5946, 12.9716, 77.5946)
    assert dist == 0.0


def test_haversine_known_distance():
    """Distance between Bangalore (12.9716, 77.5946) and Mysore (12.2958, 76.6394) is ~128 km."""
    dist = calculate_haversine_distance(12.9716, 77.5946, 12.2958, 76.6394)
    assert 120.0 < dist < 140.0


def test_haversine_antipodal_poles():
    """Distance from North Pole to South Pole is approximately pi * R ≈ 20,015 km."""
    dist = calculate_haversine_distance(90.0, 0.0, -90.0, 0.0)
    assert 20000.0 < dist < 20030.0


# =========================================================================
# 2. Facility Model & Schema Validation Tests
# =========================================================================

def test_facility_type_enum():
    """Verify all required facility types exist."""
    assert FacilityType.SUB_CENTRE.value == "SUB_CENTRE"
    assert FacilityType.PHC.value == "PHC"
    assert FacilityType.RURAL_HOSPITAL.value == "RURAL_HOSPITAL"
    assert FacilityType.DISTRICT_HOSPITAL.value == "DISTRICT_HOSPITAL"


def test_facility_create_valid_schema():
    """Valid payload creates schema properly."""
    payload = FacilityCreate(
        id="FAC_TEST_01",
        name="Community Health Center",
        facility_type=FacilityType.PHC,
        address="123 Village Road, District A",
        latitude=13.0827,
        longitude=80.2707,
        contact_phone="+91-9876543210",
        contact_email="phc@health.gov.in",
        contact_info="Open 24x7 for emergencies",
        is_active=True,
    )
    assert payload.name == "Community Health Center"
    assert payload.latitude == 13.0827
    assert payload.longitude == 80.2707


def test_facility_latitude_validation_failure():
    """Latitude outside -90 to +90 should be rejected."""
    with pytest.raises(ValueError):
        FacilityCreate(
            name="Invalid Lat Facility",
            facility_type=FacilityType.SUB_CENTRE,
            address="Test Address",
            latitude=95.0,  # Invalid
            longitude=77.0,
        )


def test_facility_longitude_validation_failure():
    """Longitude outside -180 to +180 should be rejected."""
    with pytest.raises(ValueError):
        FacilityCreate(
            name="Invalid Lon Facility",
            facility_type=FacilityType.SUB_CENTRE,
            address="Test Address",
            latitude=12.0,
            longitude=185.0,  # Invalid
        )


def test_facility_empty_name_rejected():
    """Empty or whitespace name should be rejected."""
    with pytest.raises(ValueError):
        FacilityCreate(
            name="   ",
            facility_type=FacilityType.SUB_CENTRE,
            address="Valid Address",
            latitude=12.0,
            longitude=77.0,
        )


# =========================================================================
# 3. Service Layer CRUD & Discovery Tests
# =========================================================================

def test_service_create_and_get(db_session):
    """Test FacilityService create and get by ID."""
    facility_in = FacilityCreate(
        id="FAC_PHC_01",
        name="Kengeri Primary Health Centre",
        facility_type=FacilityType.PHC,
        address="Kengeri Main Road, Bangalore",
        latitude=12.9172,
        longitude=77.4837,
        contact_phone="080-28480000",
        is_active=True,
    )
    created = FacilityService.create_facility(db_session, facility_in)
    assert created.id == "FAC_PHC_01"
    assert created.name == "Kengeri Primary Health Centre"

    fetched = FacilityService.get_by_id(db_session, "FAC_PHC_01")
    assert fetched is not None
    assert fetched.facility_type == FacilityType.PHC


def test_service_empty_facility_list(db_session):
    """Empty database returns empty list."""
    facilities = FacilityService.get_facilities(db_session)
    assert facilities == []


def test_service_discovery_proximity_sorting(db_session):
    """Discovered facilities must be sorted by geographic proximity."""
    # Origin: Bangalore city center (12.9716, 77.5946)
    # Facility 1: Majestic (near, ~3 km away: 12.9767, 77.5713)
    # Facility 2: Electronic City (far, ~18 km away: 12.8452, 77.6602)
    f1 = FacilityCreate(
        id="FAC_MAJESTIC",
        name="Majestic Sub Centre",
        facility_type=FacilityType.SUB_CENTRE,
        address="Majestic",
        latitude=12.9767,
        longitude=77.5713,
    )
    f2 = FacilityCreate(
        id="FAC_ECITY",
        name="Electronic City District Hospital",
        facility_type=FacilityType.DISTRICT_HOSPITAL,
        address="Electronic City",
        latitude=12.8452,
        longitude=77.6602,
    )
    FacilityService.create_facility(db_session, f1)
    FacilityService.create_facility(db_session, f2)

    # Search from Bangalore center
    results = FacilityService.discover_facilities(
        db_session, user_lat=12.9716, user_lon=77.5946
    )
    assert len(results) == 2
    assert results[0]["id"] == "FAC_MAJESTIC"
    assert results[1]["id"] == "FAC_ECITY"
    assert results[0]["distance_km"] < results[1]["distance_km"]

    # Filter with max radius of 10 km (only Majestic should match)
    near_results = FacilityService.discover_facilities(
        db_session, user_lat=12.9716, user_lon=77.5946, max_distance_km=10.0
    )
    assert len(near_results) == 1
    assert near_results[0]["id"] == "FAC_MAJESTIC"


# =========================================================================
# 4. API Route & Authentication Tests
# =========================================================================

def test_api_empty_facilities(client):
    """GET /facilities returns empty list initially."""
    response = client.get("/facilities")
    assert response.status_code == 200
    assert response.json() == []


def test_api_protected_post_without_auth(client):
    """POST /facilities without auth header must return 401 Unauthorized."""
    payload = {
        "name": "District Hospital A",
        "facility_type": "DISTRICT_HOSPITAL",
        "address": "Hospital Road",
        "latitude": 12.97,
        "longitude": 77.59,
    }
    response = client.post("/facilities", json=payload)
    assert response.status_code == 401
    assert "credentials required" in response.json()["detail"].lower()


def test_api_protected_post_with_valid_api_key(client):
    """POST /facilities with valid X-API-Key creates facility successfully."""
    headers = {"X-API-Key": "admin-secret-key"}
    payload = {
        "id": "FAC_DH_001",
        "name": "Victoria District Hospital",
        "facility_type": "DISTRICT_HOSPITAL",
        "address": "Fort Road, Bangalore",
        "latitude": 12.9629,
        "longitude": 77.5746,
        "contact_phone": "080-26701150",
    }
    response = client.post("/facilities", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "FAC_DH_001"
    assert data["facility_type"] == "DISTRICT_HOSPITAL"

    # Verify retrieval via GET /facilities/{facility_id}
    get_res = client.get("/facilities/FAC_DH_001")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Victoria District Hospital"


def test_api_protected_post_with_bearer_token(client):
    """POST /facilities with Bearer token authentication."""
    headers = {"Authorization": "Bearer operator-secret-key"}
    payload = {
        "id": "FAC_RURAL_01",
        "name": "Hoskote Rural Hospital",
        "facility_type": "RURAL_HOSPITAL",
        "address": "Hoskote",
        "latitude": 13.0712,
        "longitude": 77.7981,
    }
    response = client.post("/facilities", json=payload, headers=headers)
    assert response.status_code == 201
    assert response.json()["id"] == "FAC_RURAL_01"


def test_api_get_nonexistent_facility_returns_404(client):
    """GET /facilities/NON_EXISTENT must return 404."""
    response = client.get("/facilities/NON_EXISTENT_ID")
    assert response.status_code == 404


def test_api_discovery_endpoint(client):
    """GET /facilities/discovery returns nearest facilities."""
    headers = {"X-API-Key": "admin-secret-key"}
    f1 = {
        "id": "FAC_01",
        "name": "Central Sub Centre",
        "facility_type": "SUB_CENTRE",
        "address": "Center",
        "latitude": 12.9716,
        "longitude": 77.5946,
    }
    client.post("/facilities", json=f1, headers=headers)

    res = client.get("/facilities/discovery?latitude=12.9716&longitude=77.5946")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == "FAC_01"
    assert data[0]["distance_km"] == 0.0
