"""Tests for Medicine catalog, Facility Inventory, Derived Availability, and Safe Stock Adjustments."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.facility import Facility, FacilityType
from app.models.medicine import FacilityInventory, Medicine
from app.schemas.facility import FacilityCreate
from app.schemas.medicine import (
    FacilityInventoryCreate,
    InventoryStockAdjustment,
    MedicineCreate,
    MedicineUpdate,
)
from app.services.facility_service import FacilityService
from app.services.medicine_service import MedicineService

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
def sample_facility_a(db_session):
    """Create primary test facility."""
    return FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_PHC_CENTRAL",
            name="Central Primary Health Centre",
            facility_type=FacilityType.PHC,
            address="12 Main Market Road",
            latitude=12.9716,
            longitude=77.5946,
        ),
    )


@pytest.fixture
def sample_facility_b(db_session):
    """Create secondary test facility (10 km away)."""
    return FacilityService.create_facility(
        db_session,
        FacilityCreate(
            id="FAC_DH_NORTH",
            name="North District Hospital",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="88 North Bypass",
            latitude=13.0500,
            longitude=77.5946,
        ),
    )


@pytest.fixture
def sample_medicine(db_session):
    """Create a sample medicine in the catalog."""
    return MedicineService.create_medicine(
        db_session,
        MedicineCreate(
            id="MED_PCM_500",
            name="Paracip 500",
            generic_name="Paracetamol",
            dosage_form="Tablet",
            strength="500mg",
            manufacturer="Cipla Ltd",
        ),
    )


# =========================================================================
# 1. Medicine Entity & Validation Tests
# =========================================================================

def test_medicine_creation_and_empty_name_validation():
    """Valid medicine creates schema; empty name raises ValueError."""
    med = MedicineCreate(
        name="Amoxyclav 625",
        generic_name="Amoxicillin + Clavulanic Acid",
        dosage_form="Tablet",
        strength="625mg",
    )
    assert med.name == "Amoxyclav 625"

    with pytest.raises(ValueError, match="cannot be empty"):
        MedicineCreate(name="   ", generic_name="Amoxicillin")


def test_medicine_catalog_search(db_session, sample_medicine):
    """Search by brand name or generic name matches correctly."""
    MedicineService.create_medicine(
        db_session,
        MedicineCreate(
            id="MED_AMOX_500",
            name="Novamox 500",
            generic_name="Amoxicillin",
            dosage_form="Capsule",
        ),
    )

    # Search generic name
    pcm_results = MedicineService.get_medicines(db_session, query="paracetamol")
    assert len(pcm_results) == 1
    assert pcm_results[0].id == "MED_PCM_500"

    # Search brand name
    amox_results = MedicineService.get_medicines(db_session, query="Novamox")
    assert len(amox_results) == 1
    assert amox_results[0].id == "MED_AMOX_500"


# =========================================================================
# 2. Facility Inventory & Derived Availability Tests
# =========================================================================

def test_inventory_derived_availability_status(db_session, sample_facility_a, sample_medicine):
    """Verify availability status is logically derived from quantity."""
    # 1. Quantity > 0 -> AVAILABLE
    inv = MedicineService.set_or_update_inventory(
        db_session,
        FacilityInventoryCreate(
            facility_id=sample_facility_a.id,
            medicine_id=sample_medicine.id,
            quantity=150,
            unit="tablets",
        ),
    )
    assert inv.is_available is True
    assert inv.availability_status == "AVAILABLE"
    assert inv.quantity == 150

    # 2. Quantity == 0 -> UNAVAILABLE
    inv_zero = MedicineService.set_or_update_inventory(
        db_session,
        FacilityInventoryCreate(
            facility_id=sample_facility_a.id,
            medicine_id=sample_medicine.id,
            quantity=0,
            unit="tablets",
        ),
    )
    assert inv_zero.is_available is False
    assert inv_zero.availability_status == "UNAVAILABLE"
    assert inv_zero.quantity == 0


def test_inventory_negative_quantity_rejected(db_session, sample_facility_a, sample_medicine):
    """Negative stock quantity must be rejected."""
    with pytest.raises(ValueError):
        FacilityInventoryCreate(
            facility_id=sample_facility_a.id,
            medicine_id=sample_medicine.id,
            quantity=-10,
        )


def test_safe_stock_adjustment_and_dispensing(db_session, sample_facility_a, sample_medicine):
    """Test atomic restocking and safe dispensing with negative-stock prevention."""
    # Initial stock: 100
    MedicineService.set_or_update_inventory(
        db_session,
        FacilityInventoryCreate(
            facility_id=sample_facility_a.id,
            medicine_id=sample_medicine.id,
            quantity=100,
        ),
    )

    # Dispense 30 -> 70 remaining
    inv_dispensed = MedicineService.adjust_stock(
        db_session, sample_facility_a.id, sample_medicine.id, delta=-30
    )
    assert inv_dispensed.quantity == 70
    assert inv_dispensed.is_available is True

    # Attempt to dispense 80 (exceeds 70) -> must raise ValueError
    with pytest.raises(ValueError, match="Insufficient inventory"):
        MedicineService.adjust_stock(
            db_session, sample_facility_a.id, sample_medicine.id, delta=-80
        )

    # Verify stock remained at 70 after rejected transaction
    check_inv = MedicineService.check_facility_medicine_stock(
        db_session, sample_facility_a.id, sample_medicine.id
    )
    assert check_inv.quantity == 70

    # Restock 50 -> 120
    inv_restocked = MedicineService.adjust_stock(
        db_session, sample_facility_a.id, sample_medicine.id, delta=50
    )
    assert inv_restocked.quantity == 120


def test_find_facilities_with_medicine(
    db_session, sample_facility_a, sample_facility_b, sample_medicine
):
    """Locate facilities stocking a medicine sorted by geographic distance."""
    # Facility A: 50 tablets (at origin: 12.9716, 77.5946)
    MedicineService.set_or_update_inventory(
        db_session,
        FacilityInventoryCreate(
            facility_id=sample_facility_a.id,
            medicine_id=sample_medicine.id,
            quantity=50,
        ),
    )
    # Facility B: 200 tablets (10 km away: 13.0500, 77.5946)
    MedicineService.set_or_update_inventory(
        db_session,
        FacilityInventoryCreate(
            facility_id=sample_facility_b.id,
            medicine_id=sample_medicine.id,
            quantity=200,
        ),
    )

    # Search from Facility A location
    results = MedicineService.find_facilities_with_medicine(
        db_session,
        medicine_id=sample_medicine.id,
        user_lat=12.9716,
        user_lon=77.5946,
    )
    assert len(results) == 2
    assert results[0]["facility_id"] == sample_facility_a.id
    assert results[0]["distance_km"] == 0.0
    assert results[1]["facility_id"] == sample_facility_b.id
    assert results[1]["distance_km"] > 5.0


# =========================================================================
# 3. API Endpoints & Authorization Tests
# =========================================================================

def test_api_list_medicines(client, sample_medicine):
    """GET /medicines returns catalog."""
    res = client.get("/medicines?query=Paracip")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == sample_medicine.id
    assert data[0]["name"] == "Paracip 500"


def test_api_protected_create_medicine(client):
    """POST /medicines requires admin/operator authorization."""
    payload = {
        "name": "Metformin 500",
        "generic_name": "Metformin Hydrochloride",
        "dosage_form": "Tablet",
        "strength": "500mg",
    }
    # Unauthenticated -> 401
    assert client.post("/medicines", json=payload).status_code == 401

    # Authenticated -> 201
    headers = {"X-API-Key": "admin-secret-key"}
    res = client.post("/medicines", json=payload, headers=headers)
    assert res.status_code == 201
    assert res.json()["name"] == "Metformin 500"


def test_api_set_inventory_and_dispense_flow(client, sample_facility_a, sample_medicine):
    """Test full inventory setup, retrieval, and adjustment cycle via API."""
    headers = {"Authorization": "Bearer operator-secret-key"}

    # 1. Set inventory stock to 80
    inv_payload = {
        "facility_id": sample_facility_a.id,
        "medicine_id": sample_medicine.id,
        "quantity": 80,
        "unit": "strips",
    }
    set_res = client.post(
        f"/facilities/{sample_facility_a.id}/inventory",
        json=inv_payload,
        headers=headers,
    )
    assert set_res.status_code == 201
    assert set_res.json()["quantity"] == 80
    assert set_res.json()["availability_status"] == "AVAILABLE"

    # 2. Check facility inventory endpoint
    list_res = client.get(f"/facilities/{sample_facility_a.id}/inventory")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 3. Dispense 30 via adjust endpoint
    adjust_res = client.post(
        f"/facilities/{sample_facility_a.id}/inventory/adjust?medicine_id={sample_medicine.id}",
        json={"delta_quantity": -30, "reason": "Patient prescription dispensing"},
        headers=headers,
    )
    assert adjust_res.status_code == 200
    assert adjust_res.json()["quantity"] == 50

    # 4. Attempt excessive deduction (-60 when only 50 available) -> 400
    fail_res = client.post(
        f"/facilities/{sample_facility_a.id}/inventory/adjust?medicine_id={sample_medicine.id}",
        json={"delta_quantity": -60},
        headers=headers,
    )
    assert fail_res.status_code == 400
    assert "insufficient inventory" in fail_res.json()["detail"].lower()
