"""
VIZITOR - Local Development Seed Utility
=========================================
Safely seeds a verified local development user, patient profile, and sample
Patient Report healthcare records strictly in the LOCAL database.
DOES NOT touch Render or any remote production database.
"""

import asyncio
from datetime import date, datetime, timedelta
import sys

from sqlalchemy import select

from app.database import engine, Base, SessionLocal
import app.main  # Register all models and relationships
from app.models.user import User
from app.models.patient import Patient
from app.models.medical_record import MedicalRecord
from app.models.follow_up import FollowUp
from app.models.maternal_child import MaternalChildRecord
from app.models.chronic_disease import ChronicDiseaseRecord
from app.utils.security import hash_password


async def seed_local_development():
    print("\n==================================================")
    print("VIZITOR LOCAL DEVELOPMENT SEED")
    print("==================================================")

    # 1. Ensure all tables exist in local SQLite
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        # 2. Check if we should verify existing local accounts
        verify_all = "--verify-all" in sys.argv or True  # Automatically verify local development accounts

        if verify_all:
            result = await db.execute(select(User).where(User.is_verified == False))
            unverified_users = result.scalars().all()
            for u in unverified_users:
                u.is_verified = True
                print(f"Verified existing local user: {u.email} (ID: {u.user_id})")
            if unverified_users:
                await db.commit()

        # 3. Get or create a primary development user
        target_email = "dev@vizitor.test"
        result = await db.execute(select(User).where(User.email == target_email))
        dev_user = result.scalar_one_or_none()

        if not dev_user:
            # Also check if aryansahoo211@gmail.com exists
            result = await db.execute(select(User).where(User.email == "aryansahoo211@gmail.com"))
            existing_aryan = result.scalar_one_or_none()
            if existing_aryan:
                dev_user = existing_aryan
                dev_user.is_verified = True
                print(f"Using existing account: {dev_user.email} (ID: {dev_user.user_id})")
            else:
                # Find max user_id
                res_max = await db.execute(select(User.user_id).order_by(User.user_id.desc()))
                max_id = res_max.scalars().first()
                new_id = f"{int(max_id) + 1:03d}" if max_id and max_id.isdigit() else "001"

                dev_user = User(
                    user_id=new_id,
                    full_name="Aryan Kumar",
                    email=target_email,
                    password_hash=hash_password("Vizitor@123"),
                    role="user",
                    is_verified=True,
                    created_at=datetime.utcnow()
                )
                db.add(dev_user)
                await db.commit()
                await db.refresh(dev_user)
                print(f"Created dev user: {dev_user.email} with password 'Vizitor@123'")

        # 4. Ensure Patient profile exists for this user
        result = await db.execute(select(Patient).where(Patient.user_id == dev_user.user_id))
        patient = result.scalar_one_or_none()

        patient_id = f"P{dev_user.user_id}"

        if not patient:
            patient = Patient(
                patient_id=patient_id,
                user_id=dev_user.user_id,
                full_name=dev_user.full_name or "Aryan Kumar",
                age=24,
                gender="Male",
                contact_number="+91 9876543210",
                location="Khurda, Odisha",
                emergency_contact="+91 9876500000",
                blood_group="B+",
                allergies="Penicillin",
                existing_conditions="Mild Asthma",
                current_medications="Albuterol Inhaler as needed",
                risk_status="NORMAL",
                last_visit=date.today() - timedelta(days=12),
                next_followup=date.today() + timedelta(days=15),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(patient)
            await db.commit()
            await db.refresh(patient)
            print(f"Created Patient profile: {patient.patient_id} for user {dev_user.user_id}")
        else:
            print(f"Existing Patient profile found: {patient.patient_id}")

        # 5. Seed sample Medical Records if empty
        rec_check = await db.execute(select(MedicalRecord).where(MedicalRecord.patient_id == patient.patient_id))
        if not rec_check.scalars().first():
            records = [
                MedicalRecord(
                    patient_id=patient.patient_id,
                    record_type="OPD Consultation",
                    visit_date=date.today() - timedelta(days=12),
                    facility_name="District Hospital Khurda",
                    department="General Medicine",
                    diagnosis="Seasonal allergic bronchitis",
                    prescription="Cetirizine 10mg once daily for 5 days, Salbutamol inhaler PRN",
                    test_results="Chest X-ray clear, SpO2 99%",
                    referral=None,
                    follow_up_notes="Follow up if wheezing persists past 2 weeks."
                ),
                MedicalRecord(
                    patient_id=patient.patient_id,
                    record_type="Annual Health Checkup",
                    visit_date=date.today() - timedelta(days=90),
                    facility_name="Community Health Centre",
                    department="Preventive Healthcare",
                    diagnosis="Routine checkup - normal vitals",
                    prescription="Multivitamin once daily",
                    test_results="Blood sugar 92 mg/dL, BP 120/80 mmHg, Hemoglobin 14.2 g/dL",
                    referral=None,
                    follow_up_notes="Annual review recommended."
                )
            ]
            for r in records:
                db.add(r)
            print("Seeded sample Medical Records.")

        # 6. Seed sample Follow-up Alerts if empty
        fu_check = await db.execute(select(FollowUp).where(FollowUp.patient_id == patient.patient_id))
        if not fu_check.scalars().first():
            follow_ups = [
                FollowUp(
                    patient_id=patient.patient_id,
                    follow_up_type="Respiratory Review",
                    scheduled_date=date.today() + timedelta(days=15),
                    completed=False,
                    missed=False,
                    alert_status="PENDING",
                    notes="Check spirometry and review inhaler technique."
                ),
                FollowUp(
                    patient_id=patient.patient_id,
                    follow_up_type="Blood Pressure Monitoring",
                    scheduled_date=date.today() - timedelta(days=2),
                    completed=False,
                    missed=True,
                    alert_status="MISSED",
                    notes="Scheduled 6-month blood pressure and vitals check."
                )
            ]
            for fu in follow_ups:
                db.add(fu)
            print("Seeded sample Follow-up alerts.")

        # 7. Seed sample Chronic Disease Record if empty
        cd_check = await db.execute(select(ChronicDiseaseRecord).where(ChronicDiseaseRecord.patient_id == patient.patient_id))
        if not cd_check.scalars().first():
            cd = ChronicDiseaseRecord(
                patient_id=patient.patient_id,
                disease_name="Asthma",
                diagnosis_status="CONTROLLED",
                diagnosis_date=date.today() - timedelta(days=365),
                medication="Albuterol Inhaler (100mcg)",
                checkup_date=date.today() - timedelta(days=12),
                checkup_notes="Lungs clear on auscultation, no nocturnal symptoms.",
                next_follow_up=date.today() + timedelta(days=30),
                missed_visit=False,
                reminder_status="PENDING",
                notes="Patient reports good compliance."
            )
            db.add(cd)
            print("Seeded sample Chronic Disease record.")

        # 8. Seed sample Maternal & Child Record if empty
        mc_check = await db.execute(select(MaternalChildRecord).where(MaternalChildRecord.patient_id == patient.patient_id))
        if not mc_check.scalars().first():
            mc = MaternalChildRecord(
                patient_id=patient.patient_id,
                record_category="CHILD",
                child_name="Aarav Kumar",
                child_date_of_birth=date.today() - timedelta(days=400),
                child_vaccination="Pentavalent-3, OPV-3, Rota-3 completed",
                child_checkup_date=date.today() - timedelta(days=35),
                child_checkup_notes="Weight 9.8 kg, height 78 cm. Growth parameters on 50th percentile.",
                missed_follow_up=False,
                next_follow_up=date.today() + timedelta(days=45),
                notes="Next due for MR-1 & Vitamin A dose."
            )
            db.add(mc)
            print("Seeded sample Maternal & Child record.")

        await db.commit()

        print("\n==================================================")
        print("SEEDING COMPLETE!")
        print("==================================================")
        print(f"User ID   : {dev_user.user_id}")
        print(f"Full Name : {dev_user.full_name}")
        print(f"Email     : {dev_user.email}")
        print(f"Password  : Vizitor@123")
        print(f"Verified  : {dev_user.is_verified}")
        print(f"Patient ID: {patient.patient_id}")
        print("==================================================\n")


if __name__ == "__main__":
    asyncio.run(seed_local_development())