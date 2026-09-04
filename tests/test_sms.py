"""Comprehensive test suite for SMS Token Notification System."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models.appointment import Appointment, AppointmentStatus
from app.models.facility import Facility, FacilityType
from app.models.sms import SMSDeliveryRecord, SMSStatus
from app.models.specialist import Specialist
from app.services.sms_service import BaseSMSProvider, MockSMSProvider, SMSProviderResult, SMSService


# Use a unique named SQLite file to avoid sharing the StaticPool connection
# with other test files that have different schema (no phone_number column).
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_sms_isolated.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


ADMIN_HEADERS = {"X-API-Key": "admin-secret-key"}


@pytest.fixture(autouse=True)
def setup_database():
    """Re-create clean tables for every test and ensure the DB override is active."""
    # Re-register override here so other test files cannot stomp on us
    app.dependency_overrides[get_db] = override_get_db

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Seed facility and specialist
    fac = Facility(
        id="FAC_SMS_TEST",
        name="Apollo Rural PHC",
        facility_type=FacilityType.PHC,
        address="Vill. Kheda, Gujarat",
        latitude=23.0225,
        longitude=72.5714,
    )
    db.add(fac)
    db.commit()

    spec = Specialist(
        id="SPEC_SMS_TEST",
        facility_id="FAC_SMS_TEST",
        name="Dr. Sharma",
        specialization="Cardiology",
        slot_duration_minutes=15,
    )
    db.add(spec)
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


# Build client AFTER fixture registration so it picks up the override correctly
client = TestClient(app)


def test_sms_masking_utility():
    """Verify phone masking never leaks middle digits."""
    assert SMSService.mask_phone_number("+919876543210") == "+91 ******3210"
    assert SMSService.mask_phone_number("9876543210") == "******3210"
    assert SMSService.mask_phone_number("123") == "****"
    assert SMSService.mask_phone_number("") == "N/A"
    assert SMSService.mask_phone_number(None) == "N/A"


def test_mock_sms_provider_success():
    """Verify MockSMSProvider successfully logs and dispatches messages."""
    provider = MockSMSProvider()
    res = provider.send_sms("+919876543210", "Test token message")
    assert res.success is True
    assert res.provider_message_id is not None
    assert res.provider_message_id.startswith("MOCK_SMS_")
    assert len(provider.sent_messages) == 1
    assert provider.sent_messages[0]["to_phone"] == "+919876543210"


def test_mock_sms_provider_simulated_failure():
    """Verify MockSMSProvider simulates failure on invalid marker."""
    provider = MockSMSProvider()
    res = provider.send_sms("0000000000", "Test token message")
    assert res.success is False
    assert "Carrier rejected" in res.error


def test_automatic_sms_on_appointment_creation():
    """Verify appointment creation with phone number automatically dispatches SMS."""
    payload = {
        "facility_id": "FAC_SMS_TEST",
        "patient_name": "Ramesh Patel",
        "phone_number": "+919876543210",
        "specialist_id": "SPEC_SMS_TEST",
        "department": "Cardiology",
        "slot_start_time": "10:00",
    }
    resp = client.post("/appointments", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["token_number"] is not None
    assert data["phone_number"] == "+919876543210"

    # Verify SMS Delivery Record was persisted in database
    db = TestingSessionLocal()
    records = db.query(SMSDeliveryRecord).filter(SMSDeliveryRecord.appointment_id == data["id"]).all()
    assert len(records) == 1
    assert records[0].status == SMSStatus.SENT
    assert records[0].phone_number == "+919876543210"
    assert "Token #" in records[0].message_body
    db.close()


def test_appointment_creation_succeeds_when_sms_fails():
    """Appointment creation MUST NOT fail if SMS dispatch fails."""
    # Using 000000 marker which triggers simulated failure in Mock provider
    payload = {
        "facility_id": "FAC_SMS_TEST",
        "patient_name": "Suresh Kumar",
        "phone_number": "0000001234",
        "specialist_id": "SPEC_SMS_TEST",
        "department": "Cardiology",
        "slot_start_time": "10:15",
    }
    resp = client.post("/appointments", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["token_number"] is not None

    db = TestingSessionLocal()
    records = db.query(SMSDeliveryRecord).filter(SMSDeliveryRecord.appointment_id == data["id"]).all()
    assert len(records) == 1
    assert records[0].status == SMSStatus.FAILED
    assert records[0].error_message is not None
    db.close()


def test_appointment_without_phone_creates_no_sms():
    """Appointments without phone number do not trigger SMS."""
    payload = {
        "facility_id": "FAC_SMS_TEST",
        "patient_name": "Walk-in Patient",
        "specialist_id": "SPEC_SMS_TEST",
        "department": "Cardiology",
        "slot_start_time": "10:30",
    }
    resp = client.post("/appointments", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    db = TestingSessionLocal()
    records = db.query(SMSDeliveryRecord).filter(SMSDeliveryRecord.appointment_id == data["id"]).all()
    assert len(records) == 0
    db.close()


def test_resend_sms_endpoint_protected():
    """Verify POST /appointments/{id}/sms requires authorization."""
    # Create appointment first
    apt_resp = client.post(
        "/appointments",
        json={
            "facility_id": "FAC_SMS_TEST",
            "patient_name": "Pooja Verma",
            "phone_number": "+919876543210",
        },
    )
    apt_id = apt_resp.json()["id"]

    # Without auth header -> 401
    unauth_resp = client.post(f"/appointments/{apt_id}/sms", json={})
    assert unauth_resp.status_code == 401

    # With auth header -> 200
    auth_resp = client.post(
        f"/appointments/{apt_id}/sms",
        json={"phone_number": "+919123456789"},
        headers=ADMIN_HEADERS,
    )
    assert auth_resp.status_code == 200
    data = auth_resp.json()
    assert data["appointment_id"] == apt_id
    assert data["phone_number"] == "+91 ******6789"
    assert data["sms_status"] in ["SENT", "PENDING"]


def test_resend_sms_invalid_appointment_id():
    """Verify 404 is returned when resending SMS for non-existent appointment."""
    resp = client.post(
        "/appointments/APT_NONEXISTENT/sms",
        json={"phone_number": "+919876543210"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 404


def test_resend_sms_missing_phone_number_error():
    """Verify error when resending without existing or provided phone number."""
    # Create appointment without phone
    apt_resp = client.post(
        "/appointments",
        json={
            "facility_id": "FAC_SMS_TEST",
            "patient_name": "No Phone User",
        },
    )
    apt_id = apt_resp.json()["id"]

    resp = client.post(
        f"/appointments/{apt_id}/sms",
        json={},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 400
    assert "No phone number" in resp.json()["detail"]


def test_get_sms_history():
    """Verify GET /appointments/{id}/sms returns audit trail."""
    apt_resp = client.post(
        "/appointments",
        json={
            "facility_id": "FAC_SMS_TEST",
            "patient_name": "History Test",
            "phone_number": "+919876543210",
        },
    )
    apt_id = apt_resp.json()["id"]

    history_resp = client.get(f"/appointments/{apt_id}/sms", headers=ADMIN_HEADERS)
    assert history_resp.status_code == 200
    records = history_resp.json()
    assert len(records) >= 1
    assert records[0]["appointment_id"] == apt_id
    assert records[0]["status"] == "SENT"
