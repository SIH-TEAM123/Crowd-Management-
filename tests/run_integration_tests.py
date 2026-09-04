"""
VIZITOR Integration Test Runner
Fast direct runner importing database models directly without loading ML routers
"""

import asyncio
import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath("."))

from datetime import date, datetime, time, timedelta
from uuid import uuid4

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


TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(TEST_DB_URL, echo=False)
TestingSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def teardown_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def test_1_token_starts_at_114():
    print("Test 1: Starting token is strictly 114 (A-114)...", end=" ")
    engine_inst = QueueEngine()
    assert engine_inst.token_display_for(1) == "A-114"
    assert engine_inst.token_number_for(1) == 114
    assert engine_inst.token_display_for(2) == "A-115"
    assert engine_inst.token_number_for(2) == 115
    assert engine_inst.token_display_for(3) == "A-116"
    assert engine_inst.token_number_for(3) == 116
    print("PASSED")


async def test_2_sequential_appointments_and_fcfs():
    print("Test 2: Sequential appointment creation produces sequential tokens...", end=" ")
    await setup_db()
    try:
        async with TestingSessionLocal() as session:
            engine_inst = QueueEngine()
            user1 = User(user_id="U01", full_name="User 1", email="u1@test.com", password_hash="pw", is_verified=True)
            user2 = User(user_id="U02", full_name="User 2", email="u2@test.com", password_hash="pw", is_verified=True)
            session.add_all([user1, user2])
            await session.commit()

            tomorrow = date.today() + timedelta(days=1)
            t1 = Token(token_id=str(uuid4()), user_id=user1.user_id, queue_position=114, priority_type="NORMAL", token_status="WAITING")
            a1 = Appointment(user_id=user1.user_id, token_id=t1.token_id, purpose="Checkup", appointment_date=tomorrow, appointment_time=time(10, 0), status="PENDING")
            session.add_all([t1, a1])
            await session.commit()
            await session.refresh(a1)
            assert engine_inst.token_display_for(a1.appointment_id) == "A-114"

            t2 = Token(token_id=str(uuid4()), user_id=user2.user_id, queue_position=115, priority_type="NORMAL", token_status="WAITING")
            a2 = Appointment(user_id=user2.user_id, token_id=t2.token_id, purpose="Dental", appointment_date=tomorrow, appointment_time=time(10, 15), status="PENDING")
            session.add_all([t2, a2])
            await session.commit()
            await session.refresh(a2)
            assert engine_inst.token_display_for(a2.appointment_id) == "A-115"
            print("PASSED")
    finally:
        await teardown_db()


async def test_3_same_user_multiple_appointments_unique_crowd():
    print("Test 3: Same user with multiple appointments = ONE physical person in crowd...", end=" ")
    await setup_db()
    try:
        async with TestingSessionLocal() as session:
            engine_inst = QueueEngine()
            user_a = User(user_id="UA1", full_name="User A", email="usera@test.com", password_hash="pw", is_verified=True)
            session.add(user_a)
            await session.commit()

            tomorrow = date.today() + timedelta(days=1)
            for i in range(1, 4):
                t = Token(token_id=str(uuid4()), user_id=user_a.user_id, queue_position=113 + i, priority_type="NORMAL", token_status="WAITING")
                a = Appointment(user_id=user_a.user_id, token_id=t.token_id, purpose=f"Service {i}", appointment_date=tomorrow, appointment_time=time(11, i * 10), status="PENDING")
                session.add_all([t, a])

            await session.commit()
            status = await engine_inst.get_queue_status(session, user_a)

            assert status["queue_size"] == 3, f"Expected queue_size=3, got {status['queue_size']}"
            assert status["people_currently_present"] == 1, f"Expected unique people=1, got {status['people_currently_present']}"
            print("PASSED")
    finally:
        await teardown_db()


async def test_4_simulation_uses_same_queue_engine():
    print("Test 4: Simulation uses identical queue engine & advances position correctly...", end=" ")
    await setup_db()
    try:
        async with TestingSessionLocal() as session:
            engine_inst = QueueEngine()
            user = User(user_id="USM", full_name="Sim User", email="sim@test.com", password_hash="pw", is_verified=True)
            session.add(user)
            await session.commit()

            tomorrow = date.today() + timedelta(days=1)
            t = Token(token_id=str(uuid4()), user_id=user.user_id, queue_position=114, priority_type="NORMAL", token_status="WAITING")
            a = Appointment(user_id=user.user_id, token_id=t.token_id, purpose="General Checkup", appointment_date=tomorrow, appointment_time=time(9, 30), status="PENDING")
            session.add_all([t, a])
            await session.commit()

            # Normal state
            status_before = await engine_inst.get_queue_status(session, user)
            assert status_before["queue_size"] == 1
            assert status_before["people_currently_present"] == 1
            assert status_before["you"]["people_ahead"] == 0
            assert status_before["you"]["token_number"] == 114
            assert status_before["you"]["token_display"] == "A-114"

            # Activate simulation with 50 synthetic users ahead
            engine_inst.start_simulation(num_users=50, service_rate_minutes=4.0)
            status_sim = await engine_inst.get_queue_status(session, user)

            assert status_sim["queue_size"] == 51
            assert status_sim["simulation_active"] is True
            assert status_sim["simulation_synthetic_users"] == 50
            assert status_sim["people_currently_present"] == 51
            assert status_sim["you"]["people_ahead"] == 50
            assert status_sim["you"]["token_number"] == 165
            assert status_sim["you"]["token_display"] == "A-165"
            assert status_sim["you"]["estimated_wait_minutes"] == 200.0

            # Reset simulation
            engine_inst.reset_simulation()
            status_after = await engine_inst.get_queue_status(session, user)
            assert status_after["simulation_active"] is False
            assert status_after["queue_size"] == 1
            assert status_after["you"]["token_number"] == 114
            print("PASSED")
    finally:
        await teardown_db()


async def test_5_emergency_priority_expedited():
    print("Test 5: Emergency priority appointment is placed at front of queue...", end=" ")
    await setup_db()
    try:
        async with TestingSessionLocal() as session:
            engine_inst = QueueEngine()
            u_normal = User(user_id="U_NORM", full_name="Normal User", email="norm@test.com", password_hash="pw", is_verified=True)
            u_emerg = User(user_id="U_EMRG", full_name="Emerg User", email="emrg@test.com", password_hash="pw", is_verified=True)
            session.add_all([u_normal, u_emerg])
            await session.commit()

            tomorrow = date.today() + timedelta(days=1)
            t_norm = Token(token_id=str(uuid4()), user_id=u_normal.user_id, queue_position=114, priority_type="NORMAL", token_status="WAITING")
            a_norm = Appointment(user_id=u_normal.user_id, token_id=t_norm.token_id, purpose="Consultation", appointment_date=tomorrow, appointment_time=time(9, 0), status="PENDING")
            session.add_all([t_norm, a_norm])
            await session.commit()

            t_emerg = Token(token_id=str(uuid4()), user_id=u_emerg.user_id, queue_position=115, priority_type="EMERGENCY", token_status="WAITING")
            a_emerg = Appointment(user_id=u_emerg.user_id, token_id=t_emerg.token_id, purpose="Cardiac Emergency", appointment_date=tomorrow, appointment_time=time(9, 30), status="PENDING")
            session.add_all([t_emerg, a_emerg])
            await session.commit()

            ordered = await engine_inst.get_active_appointments_ordered(session)
            assert len(ordered) == 2
            assert ordered[0].appointment_id == a_emerg.appointment_id, "Emergency was not placed first!"
            assert ordered[1].appointment_id == a_norm.appointment_id, "Normal was not placed second!"
            print("PASSED")
    finally:
        await teardown_db()


async def test_6_crowd_level_classification():
    print("Test 6: Crowd level classification...", end=" ")
    engine_inst = QueueEngine()
    assert engine_inst.calculate_crowd_level(0) == "No Crowd"
    assert engine_inst.calculate_crowd_level(3) == "Low"
    assert engine_inst.calculate_crowd_level(5) == "Low"
    assert engine_inst.calculate_crowd_level(10) == "Moderate"
    assert engine_inst.calculate_crowd_level(15) == "Moderate"
    assert engine_inst.calculate_crowd_level(20) == "High"
    assert engine_inst.calculate_crowd_level(30) == "High"
    assert engine_inst.calculate_crowd_level(45) == "Critical"
    print("PASSED")


async def test_7_qr_payload_and_svg_generation():
    print("Test 7: QR Code payload and SVG generation...", end=" ")
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
    svg = generate_qr_svg(payload, size=240)
    assert svg.startswith("<svg")
    assert svg.endswith("</svg>")
    assert 'viewBox="0 0 240 240"' in svg
    print("PASSED")


async def main():
    print("=" * 70)
    print("VIZITOR UNIFIED QUEUE & TOKEN ENGINE TEST SUITE")
    print("=" * 70)

    await test_1_token_starts_at_114()
    await test_2_sequential_appointments_and_fcfs()
    await test_3_same_user_multiple_appointments_unique_crowd()
    await test_4_simulation_uses_same_queue_engine()
    await test_5_emergency_priority_expedited()
    await test_6_crowd_level_classification()
    await test_7_qr_payload_and_svg_generation()

    print("=" * 70)
    print("ALL 7 INTEGRATION TESTS PASSED PERFECTLY!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
