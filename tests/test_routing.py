"""Tests for Intelligent Facility Routing and Recommendation Service."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.facility import Facility, FacilityType
from app.models.specialist import AvailabilityStatus, Specialist
from app.models.diagnostic import DiagnosticTest
from app.models.medicine import FacilityInventory, Medicine
from app.models.referral import ReferralPriority
from app.schemas.diagnostic import DiagnosticTestCreate
from app.schemas.facility import FacilityCreate
from app.schemas.medicine import FacilityInventoryCreate, MedicineCreate
from app.schemas.routing import FacilityRoutingRequest
from app.schemas.specialist import SpecialistCreate
from app.services.diagnostic_service import DiagnosticService
from app.services.facility_service import FacilityService, calculate_haversine_distance
from app.services.medicine_service import MedicineService
from app.services.routing_service import RoutingService
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
def sample_network(db_session):
    """Create a realistic healthcare network with diverse tiers, specialists, diagnostics, and medicines."""
    # 1. Facility A: PHC (Nearby: ~5 km from 12.9716, 77.5946)
    fac_a = FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_PHC_EAST",
            name="East Primary Health Centre",
            facility_type=FacilityType.PHC,
            address="10 East Main St",
            latitude=12.9750,
            longitude=77.6300,
        ),
    )

    # 2. Facility B: Rural Hospital (~15 km away)
    fac_b = FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_RH_MID",
            name="Midland Rural Hospital",
            facility_type=FacilityType.RURAL_HOSPITAL,
            address="45 Highway Rd",
            latitude=13.0500,
            longitude=77.6000,
        ),
    )

    # 3. Facility C: District Hospital (~25 km away, fully equipped)
    fac_c = FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_DH_APEX",
            name="Apex District Hospital",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="100 Medical Center Blvd",
            latitude=13.1500,
            longitude=77.5900,
        ),
    )

    # 4. Facility D: Inactive Facility
    fac_d = FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_INACTIVE",
            name="Closed Health Centre",
            facility_type=FacilityType.SUB_CENTRE,
            address="Closed Lane",
            latitude=12.9700,
            longitude=77.5900,
            is_active=False,
        ),
    )

    # Specialists
    # Dr. Rao (Cardiologist at Facility C - AVAILABLE)
    SpecialistService.create_specialist(
        db_session,
        SpecialistCreate(
            name="Dr. K. Rao",
            specialization="Cardiology",
            facility_id=fac_c.id,
            availability_status=AvailabilityStatus.AVAILABLE,
        ),
    )
    # Dr. Anita (Cardiologist at Facility B - UNAVAILABLE)
    SpecialistService.create_specialist(
        db_session,
        SpecialistCreate(
            name="Dr. Anita Roy",
            specialization="Cardiology",
            facility_id=fac_b.id,
            availability_status=AvailabilityStatus.UNAVAILABLE,
        ),
    )
    # Dr. Mehta (General Physician at Facility A - AVAILABLE)
    SpecialistService.create_specialist(
        db_session,
        SpecialistCreate(
            name="Dr. P. Mehta",
            specialization="General Medicine",
            facility_id=fac_a.id,
            availability_status=AvailabilityStatus.AVAILABLE,
        ),
    )

    # Diagnostics
    # ECG available at A and C
    DiagnosticService.create_diagnostic(
        db_session,
        DiagnosticTestCreate(
            name="ECG",
            facility_id=fac_a.id,
            is_available=True,
        ),
    )
    DiagnosticService.create_diagnostic(
        db_session,
        DiagnosticTestCreate(
            name="ECG",
            facility_id=fac_c.id,
            is_available=True,
        ),
    )
    # MRI Brain available ONLY at C
    DiagnosticService.create_diagnostic(
        db_session,
        DiagnosticTestCreate(
            name="MRI Brain",
            facility_id=fac_c.id,
            is_available=True,
        ),
    )

    # Medicines
    med_pcm = MedicineService.create_medicine(
        db_session,
        MedicineCreate(
            id="MED_PCM",
            name="Paracetamol 500mg",
            generic_name="Paracetamol",
        ),
    )
    med_heparin = MedicineService.create_medicine(
        db_session,
        MedicineCreate(
            id="MED_HEPARIN",
            name="Heparin Injection",
            generic_name="Heparin Sodium",
        ),
    )

    # Paracetamol in stock at A (qty 100) and C (qty 500)
    MedicineService.set_or_update_inventory(
        db_session,
        FacilityInventoryCreate(
            facility_id=fac_a.id,
            medicine_id=med_pcm.id,
            quantity=100,
        ),
    )
    MedicineService.set_or_update_inventory(
        db_session,
        FacilityInventoryCreate(
            facility_id=fac_c.id,
            medicine_id=med_pcm.id,
            quantity=500,
        ),
    )
    # Heparin in stock ONLY at C (qty 50), 0 stock at A
    MedicineService.set_or_update_inventory(
        db_session,
        FacilityInventoryCreate(
            facility_id=fac_c.id,
            medicine_id=med_heparin.id,
            quantity=50,
        ),
    )
    MedicineService.set_or_update_inventory(
        db_session,
        FacilityInventoryCreate(
            facility_id=fac_a.id,
            medicine_id=med_heparin.id,
            quantity=0,
        ),
    )

    return {"fac_a": fac_a, "fac_b": fac_b, "fac_c": fac_c, "fac_d": fac_d}


# =========================================================================
# 1. Routing Feasibility & Requirement Tests
# =========================================================================

def test_haversine_distance_calculation():
    """Verify Haversine formula gives accurate distance."""
    # Distance between Bangalore (12.9716, 77.5946) and Chennai (13.0827, 80.2707) is ~290 km
    dist = calculate_haversine_distance(12.9716, 77.5946, 13.0827, 80.2707)
    assert 285.0 < dist < 300.0


def test_specialist_requirement_routing(db_session, sample_network):
    """Querying for Cardiology must match Facility C (Available) and exclude Facility B (Unavailable)."""
    req = FacilityRoutingRequest(
        latitude=12.9716,
        longitude=77.5946,
        required_specialization="Cardiology",
    )
    res = RoutingService.recommend_facilities(db_session, req)

    assert res.total_matches == 1
    assert res.recommendations[0].facility_id == "FAC_DH_APEX"
    assert "Dr. K. Rao (Cardiology)" in res.recommendations[0].availability_evidence["specialists"]


def test_diagnostic_requirement_routing(db_session, sample_network):
    """Querying for MRI Brain must only recommend Facility C."""
    req = FacilityRoutingRequest(
        latitude=12.9716,
        longitude=77.5946,
        required_diagnostic="MRI Brain",
    )
    res = RoutingService.recommend_facilities(db_session, req)

    assert res.total_matches == 1
    assert res.recommendations[0].facility_id == "FAC_DH_APEX"
    assert "MRI Brain" in res.recommendations[0].availability_evidence["diagnostics"]


def test_medicine_requirement_routing(db_session, sample_network):
    """Querying for Heparin must only match Facility C (has qty > 0) and exclude Facility A (qty == 0)."""
    req = FacilityRoutingRequest(
        latitude=12.9716,
        longitude=77.5946,
        required_medicine="Heparin",
    )
    res = RoutingService.recommend_facilities(db_session, req)

    assert res.total_matches == 1
    assert res.recommendations[0].facility_id == "FAC_DH_APEX"


def test_multi_requirement_routing(db_session, sample_network):
    """Querying for ECG and Paracetamol matches both A and C, ranked by proximity and score."""
    req = FacilityRoutingRequest(
        latitude=12.9716,
        longitude=77.5946,
        required_diagnostic="ECG",
        required_medicine="Paracetamol",
    )
    res = RoutingService.recommend_facilities(db_session, req)

    assert res.total_matches == 2
    # Facility A is closer (~3.9 km) vs Facility C (~19.8 km)
    assert res.recommendations[0].facility_id == "FAC_PHC_EAST"
    assert res.recommendations[0].distance_km < res.recommendations[1].distance_km


def test_source_facility_exclusion(db_session, sample_network):
    """When source_facility_id is provided, it must be excluded from recommendations."""
    req = FacilityRoutingRequest(
        latitude=12.9716,
        longitude=77.5946,
        required_diagnostic="ECG",
        source_facility_id="FAC_PHC_EAST",
    )
    res = RoutingService.recommend_facilities(db_session, req)

    # Only Facility C remains
    assert res.total_matches == 1
    assert res.recommendations[0].facility_id == "FAC_DH_APEX"


def test_inactive_facility_excluded(db_session, sample_network):
    """Inactive facilities are never returned in recommendations."""
    req = FacilityRoutingRequest(
        latitude=12.9700,
        longitude=77.5900,
        required_facility_type=FacilityType.SUB_CENTRE,
    )
    res = RoutingService.recommend_facilities(db_session, req)
    assert res.total_matches == 0


def test_no_suitable_facility(db_session, sample_network):
    """Searching for a non-existent specialty returns a clean empty list."""
    req = FacilityRoutingRequest(
        latitude=12.9716,
        longitude=77.5946,
        required_specialization="Pediatric Oncology",
    )
    res = RoutingService.recommend_facilities(db_session, req)
    assert res.total_matches == 0
    assert len(res.recommendations) == 0


def test_invalid_request_validation():
    """Empty request or coordinate mismatch must raise ValueError."""
    # Empty request
    with pytest.raises(ValueError, match="at least one search criterion"):
        FacilityRoutingRequest()

    # Lat without Lon
    with pytest.raises(ValueError, match="Both latitude and longitude"):
        FacilityRoutingRequest(latitude=12.97)


# =========================================================================
# 2. API Endpoints Tests (POST & GET)
# =========================================================================

def test_api_recommend_post(client, sample_network):
    """POST /facilities/recommend returns structured recommendations."""
    payload = {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "required_specialization": "Cardiology",
        "priority": "EMERGENCY",
    }
    res = client.post("/facilities/recommend", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["total_matches"] == 1
    assert data["recommendations"][0]["facility_id"] == "FAC_DH_APEX"
    assert data["recommendations"][0]["suitability_score"] > 0


def test_api_recommend_get(client, sample_network):
    """GET /facilities/recommend with query parameters returns recommendations."""
    res = client.get(
        "/facilities/recommend?latitude=12.9716&longitude=77.5946&required_diagnostic=ECG"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_matches"] == 2
