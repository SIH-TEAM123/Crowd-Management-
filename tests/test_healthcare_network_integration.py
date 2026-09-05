"""Integration tests for Healthcare Network: Facilities, Specialists, Diagnostics, Medicines, Referrals, Routing, Operational State, and SMS."""

import pytest
from datetime import datetime, timezone, date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (
    Facility, FacilityType,
    Department,
    Specialist, AvailabilityStatus,
    DiagnosticTest, DiagnosticBooking, BookingStatus, ResultStatus,
    Medicine, FacilityInventory,
    Referral, ReferralPriority, ReferralStatus,
    SMSDeliveryRecord, SMSStatus,
)
from app.schemas.facility import FacilityCreate, FacilityUpdate
from app.schemas.department import DepartmentCreate
from app.schemas.specialist import SpecialistCreate, SpecialistUpdate, DoctorScheduleUpdate
from app.schemas.diagnostic import DiagnosticTestCreate, DiagnosticBookingCreate
from app.schemas.medicine import MedicineCreate, FacilityInventoryCreate
from app.schemas.referral import ReferralCreate
from app.schemas.routing import FacilityRoutingRequest
from app.services.facility_service import FacilityService, calculate_haversine_distance
from app.services.department_service import DepartmentService
from app.services.specialist_service import SpecialistService
from app.services.diagnostic_service import DiagnosticService
from app.services.medicine_service import MedicineService
from app.services.referral_service import ReferralService
from app.services.routing_service import RoutingService
from app.services.operational_state_service import OperationalStateService


TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def sync_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_haversine_distance_calculation():
    """Verify Haversine formula gives accurate spherical distance in kilometers."""
    # Bhubaneswar to Cuttack (~19.5 km)
    dist = calculate_haversine_distance(20.2961, 85.8245, 20.4625, 85.8830)
    assert 18.0 < dist < 25.0

    # Same location gives 0 km
    assert calculate_haversine_distance(20.0, 85.0, 20.0, 85.0) == 0.0


def test_facility_service_crud_and_discovery(sync_db):
    """Test Facility registration, listing, and coordinate-based proximity discovery."""
    f1 = FacilityService.create_facility(
        sync_db,
        FacilityCreate(
            id="FAC_TEST_1",
            name="District Hospital Angul",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="Hospital Rd, Angul",
            latitude=20.8444,
            longitude=85.1011,
            contact_phone="+91 6764 230101",
        ),
    )
    assert f1.id == "FAC_TEST_1"
    assert f1.facility_type == FacilityType.DISTRICT_HOSPITAL

    f2 = FacilityService.create_facility(
        sync_db,
        FacilityCreate(
            id="FAC_TEST_2",
            name="Chhendipada CHC",
            facility_type=FacilityType.RURAL_HOSPITAL,
            address="Chhendipada, Angul",
            latitude=20.9833,
            longitude=84.8667,
            contact_phone="+91 6764 252200",
        ),
    )

    # Discovery by proximity from user at (20.85, 85.10)
    discovered = FacilityService.discover_facilities(
        sync_db,
        user_lat=20.85,
        user_lon=85.10,
        max_distance_km=50.0,
    )
    assert len(discovered) == 2
    # Nearest should be FAC_TEST_1 (< 2 km away)
    assert discovered[0]["id"] == "FAC_TEST_1"
    assert discovered[0]["distance_km"] < 2.0


def test_department_and_specialist_availability(sync_db):
    """Test Department creation, Specialist availability, and OPD slot generation."""
    fac = FacilityService.create_facility(
        sync_db,
        FacilityCreate(
            id="FAC_HOSP",
            name="Angul General Hospital",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="Angul Central",
            latitude=20.84,
            longitude=85.10,
        ),
    )

    dept = DepartmentService.create_department(
        sync_db,
        DepartmentCreate(
            facility_id=fac.id,
            name="Cardiology",
            description="Cardiac care and diagnostics",
        ),
    )
    assert dept.facility_id == fac.id

    spec = SpecialistService.create_specialist(
        sync_db,
        SpecialistCreate(
            id="SPEC_DOC_1",
            name="Dr. Rajesh Mohanty",
            specialization="Cardiology",
            department="Cardiology",
            facility_id=fac.id,
            availability_status=AvailabilityStatus.AVAILABLE,
            opd_start_time="09:00",
            opd_end_time="11:00",
            slot_duration_minutes=30,
            working_days="Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday",
            break_start_time="12:00",
            break_end_time="13:00",
        ),
    )
    assert spec.id == "SPEC_DOC_1"
    assert spec.availability_status == AvailabilityStatus.AVAILABLE

    # Generate slots for today
    slots = SpecialistService.generate_doctor_slots(sync_db, spec.id, date.today())
    assert len(slots) == 4
    assert slots[0].is_available is True


def test_diagnostic_service_and_booking_lifecycle(sync_db):
    """Test Diagnostic test catalog, availability, and strict booking state machine transitions."""
    fac = FacilityService.create_facility(
        sync_db,
        FacilityCreate(
            id="FAC_LAB",
            name="Clinical Lab Center",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="Lab Block",
            latitude=20.84,
            longitude=85.10,
        ),
    )

    diag = DiagnosticService.create_diagnostic(
        sync_db,
        DiagnosticTestCreate(
            id="DIAG_CBC",
            name="Complete Blood Count",
            category="Hematology",
            facility_id=fac.id,
            is_available=True,
            cost=150.0,
            estimated_duration_minutes=20,
        ),
    )
    assert diag.is_available is True

    # Book diagnostic test
    booking = DiagnosticService.create_booking(
        sync_db,
        DiagnosticBookingCreate(
            id="BKG_TEST_1",
            diagnostic_id=diag.id,
            facility_id=fac.id,
            patient_id="P_PAT_1",
            patient_name="Ramesh Behera",
        ),
    )
    assert booking.status == BookingStatus.REQUESTED

    # Advance state: REQUESTED -> BOOKED -> IN_PROGRESS -> COMPLETED
    b1 = DiagnosticService.update_booking_status(sync_db, booking.id, BookingStatus.BOOKED)
    assert b1.status == BookingStatus.BOOKED

    b2 = DiagnosticService.update_booking_status(sync_db, booking.id, BookingStatus.IN_PROGRESS)
    assert b2.status == BookingStatus.IN_PROGRESS

    b3 = DiagnosticService.update_booking_status(sync_db, booking.id, BookingStatus.COMPLETED)
    assert b3.status == BookingStatus.COMPLETED

    # Update result status
    res = DiagnosticService.update_result_status(sync_db, booking.id, ResultStatus.AVAILABLE)
    assert res.result_status == ResultStatus.AVAILABLE


def test_medicine_catalog_and_inventory_control(sync_db):
    """Test Medicine catalog, facility inventory setting, dispensing, and restocking."""
    fac = FacilityService.create_facility(
        sync_db,
        FacilityCreate(
            id="FAC_PHARM",
            name="District Pharmacy",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="Main Gate",
            latitude=20.84,
            longitude=85.10,
        ),
    )

    med = MedicineService.create_medicine(
        sync_db,
        MedicineCreate(
            id="MED_PCM",
            name="Paracetamol 500mg",
            generic_name="Paracetamol",
            dosage_form="Tablet",
            strength="500mg",
        ),
    )

    inv = MedicineService.set_or_update_inventory(
        sync_db,
        FacilityInventoryCreate(
            facility_id=fac.id,
            medicine_id=med.id,
            quantity=100,
            unit="tablets",
        ),
    )
    assert inv.quantity == 100
    assert inv.is_available is True

    # Dispense 30 units (delta = -30)
    adjusted = MedicineService.adjust_stock(
        sync_db,
        fac.id,
        med.id,
        delta=-30,
    )
    assert adjusted.quantity == 70

    # Restock 50 units (delta = +50)
    restocked = MedicineService.adjust_stock(
        sync_db,
        fac.id,
        med.id,
        delta=50,
    )
    assert restocked.quantity == 120


def test_intelligent_facility_routing_recommendation(sync_db):
    """Test RoutingService recommendation matching specialization, diagnostics, medicine and proximity."""
    fac_dh = FacilityService.create_facility(
        sync_db,
        FacilityCreate(
            id="FAC_DH",
            name="Apex District Hospital",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="Apex Road",
            latitude=20.85,
            longitude=85.10,
        ),
    )
    fac_phc = FacilityService.create_facility(
        sync_db,
        FacilityCreate(
            id="FAC_PHC",
            name="Village PHC",
            facility_type=FacilityType.PHC,
            address="Village Center",
            latitude=20.95,
            longitude=85.20,
        ),
    )

    # Attach Cardiology Specialist to DH
    SpecialistService.create_specialist(
        sync_db,
        SpecialistCreate(
            name="Dr. Cardio",
            specialization="Cardiology",
            facility_id=fac_dh.id,
            availability_status=AvailabilityStatus.AVAILABLE,
        ),
    )

    # Request recommendation for patient near DH needing Cardiology
    req = FacilityRoutingRequest(
        latitude=20.851,
        longitude=85.101,
        required_specialization="Cardiology",
    )
    resp = RoutingService.recommend_facilities(sync_db, req)
    assert resp.total_matches >= 1
    top_match = resp.recommendations[0]
    assert top_match.facility_id == "FAC_DH"
    assert top_match.suitability_score > 80.0
    assert "Cardiology" in str(top_match.matched_requirements)


def test_inter_facility_referrals_and_state_transitions(sync_db):
    """Test patient referral creation and state transitions."""
    f1 = FacilityService.create_facility(
        sync_db,
        FacilityCreate(
            id="FAC_SRC",
            name="Source PHC",
            facility_type=FacilityType.PHC,
            address="Village A",
            latitude=20.80,
            longitude=85.05,
        ),
    )
    f2 = FacilityService.create_facility(
        sync_db,
        FacilityCreate(
            id="FAC_DST",
            name="Tertiary Referral Hospital",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="City B",
            latitude=20.85,
            longitude=85.10,
        ),
    )

    ref = ReferralService.create_referral(
        sync_db,
        ReferralCreate(
            patient_id="P_REF_01",
            patient_name="Sarat Nayak",
            source_facility_id=f1.id,
            destination_facility_id=f2.id,
            reason="Chest pain, elevated cardiac markers",
            required_specialization="Cardiology",
            priority=ReferralPriority.URGENT,
        ),
    )
    assert ref.status == ReferralStatus.CREATED
    assert ref.priority == ReferralPriority.URGENT

    # Valid transitions: CREATED -> ACCEPTED -> IN_PROGRESS -> COMPLETED
    r1 = ReferralService.update_referral_status(sync_db, ref.id, ReferralStatus.ACCEPTED)
    assert r1.status == ReferralStatus.ACCEPTED

    r2 = ReferralService.update_referral_status(sync_db, ref.id, ReferralStatus.IN_PROGRESS)
    assert r2.status == ReferralStatus.IN_PROGRESS

    r3 = ReferralService.update_referral_status(sync_db, ref.id, ReferralStatus.COMPLETED)
    assert r3.status == ReferralStatus.COMPLETED


def test_unified_facility_operational_state(sync_db):
    """Test compilation of unified operational state across facility resources."""
    fac = FacilityService.create_facility(
        sync_db,
        FacilityCreate(
            id="FAC_OP_TEST",
            name="Operational Test Hospital",
            facility_type=FacilityType.DISTRICT_HOSPITAL,
            address="Op Road",
            latitude=20.85,
            longitude=85.10,
        ),
    )

    SpecialistService.create_specialist(
        sync_db,
        SpecialistCreate(
            name="Dr. Test",
            specialization="General",
            facility_id=fac.id,
            availability_status=AvailabilityStatus.AVAILABLE,
        ),
    )

    DiagnosticService.create_diagnostic(
        sync_db,
        DiagnosticTestCreate(
            name="Blood Test",
            facility_id=fac.id,
            is_available=True,
        ),
    )

    state = OperationalStateService.get_facility_operational_state(sync_db, fac.id)
    assert state.facility_name == "Operational Test Hospital"
    assert state.specialists_total == 1
    assert state.specialists_available == 1
    assert state.diagnostics_total == 1
    assert state.diagnostics_available == 1
