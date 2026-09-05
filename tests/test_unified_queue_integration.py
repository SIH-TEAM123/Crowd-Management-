"""
VIZITOR — Unified Queue, Token, Crowd and Simulation Engine Test Suite
======================================================================
Verifies:
1. Token numbering strictly starts from 114 (A-114).
2. Sequential continuity (114, 115, 116...).
3. One user = One physical person in crowd (no crowd inflation for multiple bookings).
4. Simulation uses identical queue engine; user token reflects existing + people ahead + own position.
5. Authoritative wait time derived from service rate and queue position.
6. Authoritative crowd level classification (Low, Moderate, High, Critical).
7. Emergency priority queue handling (expedited to front, preserving FCFS for normal).
8. QR Code generation endpoint and payload structure.
9. Simulation reset restoration.
"""

import asyncio
import pytest
import pytest_asyncio
from datetime import date, datetime, time, timedelta
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.database import Base
from app.models.user import User
from app.models.facility import Facility
from app.models.department import Department
from app.models.specialist import Specialist
from app.models.diagnostic import DiagnosticTest, DiagnosticBooking
from app.models.medicine import Medicine, FacilityInventory
from app.models.referral import Referral
from app.models.sms import SMSDeliveryRecord
from app.models.patient import Patient
from app.models.medical_record import MedicalRecord
from app.models.token import Token
from app.models.appointment import Appointment
from app.models.maternal_child import MaternalChildRecord
from app.models.chronic_disease import ChronicDiseaseRecord
from app.models.follow_up import FollowUp
from app.models.arcade_score import ArcadeScore
from app.models.article import Article
from app.models.hospital import Hospital
from app.models.otp import OTPVerification
from app.services.queue_engine import QueueEngine, TOKEN_START, SERVICE_RATE_MINUTES
from app.services.qr_service import generate_qr_svg, create_token_qr_payload


# Test in-memory SQLite engine
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(TEST_DB_URL, echo=False)
TestingSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


@pytest_asyncio.fixture(loop_scope="function")
async def db_session():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_token_starts_at_112_and_null_when_empty(db_session: AsyncSession):
    """Test 1: Initially no active token when queue is empty, first appointment receives token 112 (A-112)"""
    engine_inst = QueueEngine()

    # Initial empty state must have NO active token (NULL)
    empty_status = await engine_inst.get_queue_status(db_session)
    assert empty_status["currently_serving_token"] is None
    assert empty_status["currently_serving_number"] is None
    assert empty_status["queue_size"] == 0
    
    # Token display for first appointment is strictly 112
    assert engine_inst.token_display_for(1) == "A-112"
    assert engine_inst.token_number_for(1) == 112
    
    # Next sequential tokens
    assert engine_inst.token_display_for(2) == "A-113"
    assert engine_inst.token_number_for(2) == 113
    assert engine_inst.token_display_for(3) == "A-114"
    assert engine_inst.token_number_for(3) == 114


@pytest.mark.asyncio
async def test_sequential_appointments_and_fcfs(db_session: AsyncSession):
    """Test 2: Sequential appointment creation produces sequential tokens (112, 113, ...)"""
    engine_inst = QueueEngine()
    
    user1 = User(user_id="U01", email="u1@test.com", full_name="Test User", password_hash="pw", is_verified=True)
    user2 = User(user_id="U02", email="u2@test.com", full_name="Test User", password_hash="pw", is_verified=True)
    db_session.add_all([user1, user2])
    await db_session.commit()

    tomorrow = date.today() + timedelta(days=1)
    
    # Appointment 1
    t1 = Token(token_id=str(uuid4()), user_id=user1.user_id, queue_position=112, priority_type="NORMAL", token_status="WAITING")
    a1 = Appointment(user_id=user1.user_id, token_id=t1.token_id, purpose="Checkup", appointment_date=tomorrow, appointment_time=time(10, 0), status="PENDING")
    db_session.add_all([t1, a1])
    await db_session.commit()
    await db_session.refresh(a1)

    assert engine_inst.token_display_for(a1.appointment_id) == "A-112"

    # Appointment 2
    t2 = Token(token_id=str(uuid4()), user_id=user2.user_id, queue_position=113, priority_type="NORMAL", token_status="WAITING")
    a2 = Appointment(user_id=user2.user_id, token_id=t2.token_id, purpose="Dental", appointment_date=tomorrow, appointment_time=time(10, 15), status="PENDING")
    db_session.add_all([t2, a2])
    await db_session.commit()
    await db_session.refresh(a2)

    assert engine_inst.token_display_for(a2.appointment_id) == "A-113"


@pytest.mark.asyncio
async def test_same_user_multiple_appointments_unique_crowd(db_session: AsyncSession):
    """Test 3: CRITICAL — Same user with multiple appointments = ONE physical person in crowd"""
    engine_inst = QueueEngine()

    user_a = User(user_id="UA1", email="usera@test.com", full_name="Test User", password_hash="pw", is_verified=True)
    db_session.add(user_a)
    await db_session.commit()

    tomorrow = date.today() + timedelta(days=1)

    # User A books 3 separate appointments
    for i in range(1, 4):
        t = Token(token_id=str(uuid4()), user_id=user_a.user_id, queue_position=113 + i, priority_type="NORMAL", token_status="WAITING")
        a = Appointment(user_id=user_a.user_id, token_id=t.token_id, purpose=f"Service {i}", appointment_date=tomorrow, appointment_time=time(11, i * 10), status="PENDING")
        db_session.add_all([t, a])

    await db_session.commit()

    status = await engine_inst.get_queue_status(db_session, user_a)

    # Total appointments in queue = 3
    assert status["queue_size"] == 3
    
    # BUT unique physical people in crowd = 1! (User A is one human being)
    assert status["people_currently_present"] == 1


@pytest.mark.asyncio
async def test_simulation_uses_same_queue_engine(db_session: AsyncSession):
    """Test 4: Simulation uses the exact same queue logic and advances user position accordingly"""
    engine_inst = QueueEngine()

    user = User(user_id="USM", email="sim@test.com", full_name="Test User", password_hash="pw", is_verified=True)
    db_session.add(user)
    await db_session.commit()

    tomorrow = date.today() + timedelta(days=1)
    t = Token(token_id=str(uuid4()), user_id=user.user_id, queue_position=114, priority_type="NORMAL", token_status="WAITING")
    a = Appointment(user_id=user.user_id, token_id=t.token_id, purpose="General Checkup", appointment_date=tomorrow, appointment_time=time(9, 30), status="PENDING")
    db_session.add_all([t, a])
    await db_session.commit()

    # Normal state before simulation
    status_before = await engine_inst.get_queue_status(db_session, user)
    assert status_before["queue_size"] == 1
    assert status_before["people_currently_present"] == 1
    assert status_before["you"]["people_ahead"] == 0
    assert status_before["you"]["token_number"] == 112
    assert status_before["you"]["token_display"] == "A-112"

    # Activate simulation with 50 synthetic users ahead
    engine_inst.start_simulation(num_users=50, service_rate_minutes=4.0)

    status_sim = await engine_inst.get_queue_status(db_session, user)
    
    # Queue size includes 50 synthetic users + 1 real appointment = 51
    assert status_sim["queue_size"] == 51
    assert status_sim["simulation_active"] is True
    assert status_sim["simulation_synthetic_users"] == 50
    assert status_sim["people_currently_present"] == 51  # 50 synthetic unique + 1 real user

    # User's token reflects: currently serving (112) + people ahead (50) + 1 = 163
    assert status_sim["you"]["people_ahead"] == 50
    assert status_sim["you"]["token_number"] == 163
    assert status_sim["you"]["token_display"] == "A-163"
    assert status_sim["you"]["estimated_wait_minutes"] == 50 * 4.0

    # Reset simulation
    engine_inst.reset_simulation()
    status_after = await engine_inst.get_queue_status(db_session, user)
    assert status_after["simulation_active"] is False
    assert status_after["queue_size"] == 1
    assert status_after["you"]["token_number"] == 112


@pytest.mark.asyncio
async def test_emergency_priority_expedited(db_session: AsyncSession):
    """Test 5: Emergency priority appointment is placed at the front of the line"""
    engine_inst = QueueEngine()

    u_normal = User(user_id="U_NORM", email="norm@test.com", full_name="Test User", password_hash="pw", is_verified=True)
    u_emerg = User(user_id="U_EMRG", email="emrg@test.com", full_name="Test User", password_hash="pw", is_verified=True)
    db_session.add_all([u_normal, u_emerg])
    await db_session.commit()

    tomorrow = date.today() + timedelta(days=1)

    # First Normal Appointment booked at 09:00
    t_norm = Token(token_id=str(uuid4()), user_id=u_normal.user_id, queue_position=114, priority_type="NORMAL", token_status="WAITING")
    a_norm = Appointment(user_id=u_normal.user_id, token_id=t_norm.token_id, purpose="Consultation", appointment_date=tomorrow, appointment_time=time(9, 0), status="PENDING")
    db_session.add_all([t_norm, a_norm])
    await db_session.commit()

    # Second appointment booked later at 09:30, but with EMERGENCY priority
    t_emerg = Token(token_id=str(uuid4()), user_id=u_emerg.user_id, queue_position=115, priority_type="EMERGENCY", token_status="WAITING")
    a_emerg = Appointment(user_id=u_emerg.user_id, token_id=t_emerg.token_id, purpose="Cardiac Emergency", appointment_date=tomorrow, appointment_time=time(9, 30), status="PENDING")
    db_session.add_all([t_emerg, a_emerg])
    await db_session.commit()

    # Order in queue
    ordered = await engine_inst.get_active_appointments_ordered(db_session)
    assert len(ordered) == 2
    # Emergency appointment is first!
    assert ordered[0].appointment_id == a_emerg.appointment_id
    # Normal appointment is second!
    assert ordered[1].appointment_id == a_norm.appointment_id


@pytest.mark.asyncio
async def test_crowd_level_classification():
    """Test 6: Authoritative crowd status classification"""
    engine_inst = QueueEngine()
    assert engine_inst.calculate_crowd_level(0) == "No Crowd"
    assert engine_inst.calculate_crowd_level(3) == "Low"
    assert engine_inst.calculate_crowd_level(5) == "Low"
    assert engine_inst.calculate_crowd_level(10) == "Moderate"
    assert engine_inst.calculate_crowd_level(15) == "Moderate"
    assert engine_inst.calculate_crowd_level(20) == "High"
    assert engine_inst.calculate_crowd_level(30) == "High"
    assert engine_inst.calculate_crowd_level(45) == "Critical"


@pytest.mark.asyncio
async def test_qr_payload_and_svg_generation():
    """Test 7: QR Code payload contains correct non-sensitive pass information and valid SVG"""
    payload = create_token_qr_payload(
        appointment_id=1,
        token_display="A-114",
        user_id="U01",
        facility_id="FAC-01",
        priority_type="NORMAL"
    )

    assert payload["type"] == "queue_token"
    assert payload["appointment_id"] == 1
    assert payload["token_display"] == "A-114"
    assert "password" not in payload
    assert "jwt" not in payload

    svg = generate_qr_svg(payload, size=240)
    assert svg.startswith("<svg")
    assert svg.endswith("</svg>")
    assert 'viewBox="0 0 240 240"' in svg


@pytest.mark.asyncio
async def test_unified_token_counter_progression_with_simulation():
    """Test 8: Real booking -> Add N simulated -> Next booking receives (previous counter) + N + 1"""
    engine = QueueEngine()
    t1 = engine.token_number_for(1)
    assert t1 == engine.TOKEN_START

    t2 = engine.token_number_for(2)
    assert t2 == t1 + 1

    # Simulate adding 50 people
    sim_res = engine.start_simulation(num_users=50)
    assert sim_res["simulated_tokens_offset"] == 50

    # Next real booking must equal previous + 50 + 1
    t3 = engine.token_number_for(3)
    assert t3 == t2 + 50 + 1

    engine.reset_simulation()
    assert engine.token_number_for(1) == engine.TOKEN_START
