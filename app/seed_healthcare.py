"""Seed healthcare network data: Facilities, Departments, Specialists, Diagnostics, Medicines, Inventory, Referrals."""

import sys
import os
from datetime import datetime, timezone, timedelta

# Ensure app is in path
sys.path.insert(0, os.path.abspath("."))

from app.database import SyncSessionLocal, sync_engine, Base
from app.models import (
    Facility, FacilityType,
    Department,
    Specialist, AvailabilityStatus,
    DiagnosticTest, DiagnosticBooking, BookingStatus, ResultStatus,
    Medicine, FacilityInventory,
    Referral, ReferralPriority, ReferralStatus,
)


def seed_healthcare_network():
    db = SyncSessionLocal()
    try:
        # Check if facilities already exist
        fac_count = db.query(Facility).count()
        if fac_count == 0 or db.query(Department).count() == 0:
            print("Seeding healthcare network data...")

            # Clean duplicate dummy facilities if any
            facilities_data = [
                {
                    "id": "FAC_ANGUL_DH",
                    "name": "District Headquarters Hospital Angul",
                    "facility_type": FacilityType.DISTRICT_HOSPITAL,
                    "address": "Hospital Road, Angul, Odisha 759122",
                    "latitude": 20.8444,
                    "longitude": 85.1011,
                    "contact_phone": "+91 6764 230101",
                    "contact_email": "dhh.angul@odisha.gov.in",
                    "contact_info": "24x7 Emergency, ICU, Blood Bank, Trauma Center",
                    "is_active": True,
                },
                {
                    "id": "FAC_CHHENDIPADA_CHC",
                    "name": "Community Health Centre Chhendipada",
                    "facility_type": FacilityType.RURAL_HOSPITAL,
                    "address": "Main Road, Chhendipada, Angul, Odisha 759124",
                    "latitude": 20.9833,
                    "longitude": 84.8667,
                    "contact_phone": "+91 6764 252200",
                    "contact_email": "chc.chhendipada@odisha.gov.in",
                    "contact_info": "Maternity Ward, OPD, 24x7 Delivery, Primary Diagnostics",
                    "is_active": True,
                },
                {
                    "id": "FAC_TALCHER_PHC",
                    "name": "Primary Health Centre Talcher",
                    "facility_type": FacilityType.PHC,
                    "address": "Near Bus Stand, Talcher, Angul, Odisha 759100",
                    "latitude": 20.9500,
                    "longitude": 85.2167,
                    "contact_phone": "+91 6760 241050",
                    "contact_email": "phc.talcher@odisha.gov.in",
                    "contact_info": "Outpatient Clinic, Immunization, Basic Pharmacy",
                    "is_active": True,
                },
                {
                    "id": "FAC_BANARPAL_SC",
                    "name": "Sub-Centre Banarpal",
                    "facility_type": FacilityType.SUB_CENTRE,
                    "address": "Banarpal Block, Angul, Odisha 759128",
                    "latitude": 20.7833,
                    "longitude": 85.1500,
                    "contact_phone": "+91 6764 240012",
                    "contact_email": "sc.banarpal@odisha.gov.in",
                    "contact_info": "Community Health Worker outpost, Maternal Care",
                    "is_active": True,
                },
                {
                    "id": "FAC_BBSR_CAPITAL",
                    "name": "Capital Hospital Bhubaneswar",
                    "facility_type": FacilityType.DISTRICT_HOSPITAL,
                    "address": "Unit-6, Ganga Nagar, Bhubaneswar, Odisha 751001",
                    "latitude": 20.2600,
                    "longitude": 85.8300,
                    "contact_phone": "+91 674 2391983",
                    "contact_email": "capitalhospital@odisha.gov.in",
                    "contact_info": "Apex Multi-Specialty Centre, Super-specialty Referrals",
                    "is_active": True,
                },
            ]

            fac_map = {}
            for f_data in facilities_data:
                existing = db.query(Facility).filter(Facility.id == f_data["id"]).first()
                if not existing:
                    fac = Facility(**f_data)
                    db.add(fac)
                    db.flush()
                    fac_map[f_data["id"]] = fac
                else:
                    fac_map[f_data["id"]] = existing

            angul_dh = fac_map["FAC_ANGUL_DH"]
            chhendi_chc = fac_map["FAC_CHHENDIPADA_CHC"]
            talcher_phc = fac_map["FAC_TALCHER_PHC"]
            bbsr_dh = fac_map["FAC_BBSR_CAPITAL"]

            # Departments
            departments_data = [
                ("General Medicine", "General adult illnesses and acute primary care", angul_dh.id),
                ("Cardiology", "Cardiac evaluations, ECG, hypertension and heart care", angul_dh.id),
                ("Orthopedics", "Bone trauma, fracture setting, joint care", angul_dh.id),
                ("Pediatrics", "Neonatal care, child immunizations, nutrition", angul_dh.id),
                ("Obstetrics & Gynecology", "Antenatal, delivery, and maternal health", angul_dh.id),
                ("Emergency & Trauma", "24x7 acute emergency triage and resuscitation", angul_dh.id),
                ("Pathology & Lab", "Blood, urine, infectious disease diagnostic testing", angul_dh.id),
                ("Radiology", "X-Ray, Ultrasound, diagnostic imaging", angul_dh.id),
                ("General OPD", "Outpatient care, consultations, preventive advice", chhendi_chc.id),
                ("Maternal & Child Health", "Antenatal checkups, safe delivery", chhendi_chc.id),
                ("Pediatrics", "Child care, seasonal illnesses", chhendi_chc.id),
                ("Outpatient Clinic", "Primary consultation and triage", talcher_phc.id),
                ("Cardiology", "Tertiary cardiology, cath lab, intervention", bbsr_dh.id),
                ("Neurology", "Comprehensive neurological management", bbsr_dh.id),
            ]

            for name, desc, fid in departments_data:
                dept = Department(name=name, description=desc, facility_id=fid, is_active=True)
                db.add(dept)
            db.flush()

            # Specialists
            specialists_data = [
                {
                    "id": "SPEC_MOHANTY_CARDIO",
                    "name": "Dr. Rajesh Mohanty",
                    "specialization": "Cardiology",
                    "department": "Cardiology",
                    "facility_id": angul_dh.id,
                    "availability_status": AvailabilityStatus.AVAILABLE,
                    "schedule_info": "Mon-Sat: 09:00 AM - 01:00 PM (OPD Room 104)",
                    "opd_start_time": "09:00",
                    "opd_end_time": "13:00",
                    "slot_duration_minutes": 15,
                    "working_days": "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
                    "break_start_time": "13:00",
                    "break_end_time": "14:00",
                    "contact_phone": "+91 94370 12345",
                    "contact_email": "r.mohanty@odisha.health.gov.in",
                },
                {
                    "id": "SPEC_DAS_PEDIATRICS",
                    "name": "Dr. Priya Das",
                    "specialization": "Pediatrics",
                    "department": "Pediatrics",
                    "facility_id": angul_dh.id,
                    "availability_status": AvailabilityStatus.AVAILABLE,
                    "schedule_info": "Mon-Fri: 10:00 AM - 04:00 PM (OPD Room 202)",
                    "opd_start_time": "10:00",
                    "opd_end_time": "16:00",
                    "slot_duration_minutes": 20,
                    "working_days": "Monday,Tuesday,Wednesday,Thursday,Friday",
                    "break_start_time": "13:00",
                    "break_end_time": "14:00",
                    "contact_phone": "+91 94370 54321",
                    "contact_email": "p.das@odisha.health.gov.in",
                },
                {
                    "id": "SPEC_PATNAIK_ORTHO",
                    "name": "Dr. Subhashree Patnaik",
                    "specialization": "Orthopedics",
                    "department": "Orthopedics",
                    "facility_id": angul_dh.id,
                    "availability_status": AvailabilityStatus.AVAILABLE,
                    "schedule_info": "Mon-Sat: 09:30 AM - 02:00 PM (OPD Room 108)",
                    "opd_start_time": "09:30",
                    "opd_end_time": "14:00",
                    "slot_duration_minutes": 15,
                    "working_days": "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
                    "break_start_time": "14:00",
                    "break_end_time": "15:00",
                    "contact_phone": "+91 94371 98765",
                    "contact_email": "s.patnaik@odisha.health.gov.in",
                },
                {
                    "id": "SPEC_MISHRA_GYNEC",
                    "name": "Dr. Ananya Mishra",
                    "specialization": "Gynecology",
                    "department": "Obstetrics & Gynecology",
                    "facility_id": chhendi_chc.id,
                    "availability_status": AvailabilityStatus.AVAILABLE,
                    "schedule_info": "Mon-Sat: 09:00 AM - 03:00 PM (OPD Room 102)",
                    "opd_start_time": "09:00",
                    "opd_end_time": "15:00",
                    "slot_duration_minutes": 15,
                    "working_days": "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
                    "break_start_time": "12:30",
                    "break_end_time": "13:30",
                    "contact_phone": "+91 94372 11223",
                    "contact_email": "a.mishra@odisha.health.gov.in",
                },
                {
                    "id": "SPEC_PANDA_MEDICINE",
                    "name": "Dr. Amitav Panda",
                    "specialization": "General Medicine",
                    "department": "General Medicine",
                    "facility_id": talcher_phc.id,
                    "availability_status": AvailabilityStatus.AVAILABLE,
                    "schedule_info": "Mon-Sat: 08:30 AM - 05:00 PM (OPD Room 101)",
                    "opd_start_time": "08:30",
                    "opd_end_time": "17:00",
                    "slot_duration_minutes": 15,
                    "working_days": "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
                    "break_start_time": "13:00",
                    "break_end_time": "14:00",
                    "contact_phone": "+91 94373 33445",
                    "contact_email": "a.panda@odisha.health.gov.in",
                },
                {
                    "id": "SPEC_SENAPATI_NEURO",
                    "name": "Dr. Bijay Senapati",
                    "specialization": "Neurology",
                    "department": "Neurology",
                    "facility_id": bbsr_dh.id,
                    "availability_status": AvailabilityStatus.AVAILABLE,
                    "schedule_info": "Mon-Fri: 10:00 AM - 03:00 PM (Super-specialty Block)",
                    "opd_start_time": "10:00",
                    "opd_end_time": "15:00",
                    "slot_duration_minutes": 20,
                    "working_days": "Monday,Tuesday,Wednesday,Thursday,Friday",
                    "break_start_time": "13:00",
                    "break_end_time": "14:00",
                    "contact_phone": "+91 94374 77889",
                    "contact_email": "b.senapati@odisha.health.gov.in",
                },
            ]

            for s_data in specialists_data:
                sp = Specialist(**s_data)
                db.add(sp)
            db.flush()

            # Diagnostic Tests
            diag_tests = [
                {
                    "id": "DIAG_CBC_ANGUL",
                    "name": "Complete Blood Count (CBC)",
                    "category": "Pathology",
                    "facility_id": angul_dh.id,
                    "is_available": True,
                    "description": "Comprehensive white cell, red cell, and platelet evaluation",
                    "cost": 150.0,
                    "estimated_duration_minutes": 20,
                },
                {
                    "id": "DIAG_XRAY_ANGUL",
                    "name": "Chest X-Ray (PA View)",
                    "category": "Radiology",
                    "facility_id": angul_dh.id,
                    "is_available": True,
                    "description": "Digital planar radiograph of thorax and lungs",
                    "cost": 250.0,
                    "estimated_duration_minutes": 15,
                },
                {
                    "id": "DIAG_ECG_ANGUL",
                    "name": "ECG (12-Lead Electrocardiogram)",
                    "category": "Cardiology",
                    "facility_id": angul_dh.id,
                    "is_available": True,
                    "description": "Resting electrical conduction trace of myocardium",
                    "cost": 200.0,
                    "estimated_duration_minutes": 10,
                },
                {
                    "id": "DIAG_USG_ANGUL",
                    "name": "Ultrasound Whole Abdomen",
                    "category": "Radiology",
                    "facility_id": angul_dh.id,
                    "is_available": True,
                    "description": "High resolution transabdominal sonography",
                    "cost": 600.0,
                    "estimated_duration_minutes": 30,
                },
                {
                    "id": "DIAG_FBS_CHHENDI",
                    "name": "Fasting Blood Sugar (FBS)",
                    "category": "Pathology",
                    "facility_id": chhendi_chc.id,
                    "is_available": True,
                    "description": "Enzymatic fasting glucose titration",
                    "cost": 80.0,
                    "estimated_duration_minutes": 15,
                },
                {
                    "id": "DIAG_CBC_CHHENDI",
                    "name": "Complete Blood Count (CBC)",
                    "category": "Pathology",
                    "facility_id": chhendi_chc.id,
                    "is_available": True,
                    "description": "Automated cell counter analysis",
                    "cost": 150.0,
                    "estimated_duration_minutes": 20,
                },
                {
                    "id": "DIAG_MALARIA_TALCHER",
                    "name": "Malaria Rapid Antigen Test (RDT)",
                    "category": "Pathology",
                    "facility_id": talcher_phc.id,
                    "is_available": True,
                    "description": "Pf/Pv antigen detection dipstick test",
                    "cost": 50.0,
                    "estimated_duration_minutes": 15,
                },
            ]

            for d_data in diag_tests:
                diag = DiagnosticTest(**d_data)
                db.add(diag)
            db.flush()

            # Diagnostic Bookings (sample active queues)
            sample_bookings = [
                {
                    "id": "BKG_1001",
                    "diagnostic_id": "DIAG_CBC_ANGUL",
                    "facility_id": angul_dh.id,
                    "patient_id": "P_001",
                    "patient_name": "Ramesh Kumar Behera",
                    "status": BookingStatus.BOOKED,
                    "result_status": ResultStatus.PENDING,
                    "notes": "Routine preoperative workup",
                },
                {
                    "id": "BKG_1002",
                    "diagnostic_id": "DIAG_XRAY_ANGUL",
                    "facility_id": angul_dh.id,
                    "patient_id": "P_002",
                    "patient_name": "Minati Pradhan",
                    "status": BookingStatus.IN_PROGRESS,
                    "result_status": ResultStatus.PENDING,
                    "notes": "Suspected persistent cough / bronchitis",
                },
            ]
            for b_data in sample_bookings:
                booking = DiagnosticBooking(**b_data)
                db.add(booking)
            db.flush()

            # Medicines Master Catalog
            medicines_catalog = [
                {
                    "id": "MED_PARA_500",
                    "name": "Paracetamol 500mg",
                    "generic_name": "Paracetamol",
                    "dosage_form": "Tablet",
                    "strength": "500mg",
                    "manufacturer": "Odisha State Medical Corporation (OSMCL)",
                },
                {
                    "id": "MED_AMOX_500",
                    "name": "Amoxicillin 500mg",
                    "generic_name": "Amoxicillin",
                    "dosage_form": "Capsule",
                    "strength": "500mg",
                    "manufacturer": "OSMCL / Cipla Ltd",
                },
                {
                    "id": "MED_METF_500",
                    "name": "Metformin 500mg",
                    "generic_name": "Metformin HCl",
                    "dosage_form": "Tablet",
                    "strength": "500mg",
                    "manufacturer": "USV Pvt Ltd",
                },
                {
                    "id": "MED_AMLO_5",
                    "name": "Amlodipine 5mg",
                    "generic_name": "Amlodipine Besylate",
                    "dosage_form": "Tablet",
                    "strength": "5mg",
                    "manufacturer": "Sun Pharma",
                },
                {
                    "id": "MED_CETI_10",
                    "name": "Cetirizine 10mg",
                    "generic_name": "Cetirizine Hydrochloride",
                    "dosage_form": "Tablet",
                    "strength": "10mg",
                    "manufacturer": "Dr. Reddy's Laboratories",
                },
                {
                    "id": "MED_ORS_20",
                    "name": "Oral Rehydration Salts (ORS)",
                    "generic_name": "Oral Rehydration Salts IP",
                    "dosage_form": "Sachet",
                    "strength": "20.5g",
                    "manufacturer": "OSMCL / FDC Ltd",
                },
                {
                    "id": "MED_AZITH_500",
                    "name": "Azithromycin 500mg",
                    "generic_name": "Azithromycin",
                    "dosage_form": "Tablet",
                    "strength": "500mg",
                    "manufacturer": "Zydus Cadila",
                },
                {
                    "id": "MED_PANTO_40",
                    "name": "Pantoprazole 40mg",
                    "generic_name": "Pantoprazole Sodium",
                    "dosage_form": "Tablet",
                    "strength": "40mg",
                    "manufacturer": "Alkem Laboratories",
                },
            ]

            for m_data in medicines_catalog:
                med = Medicine(**m_data)
                db.add(med)
            db.flush()

            # Facility Inventories
            inventories_data = [
                ("FAC_ANGUL_DH", "MED_PARA_500", 2500, "tablets", "BATCH-PCM-2401", datetime(2027, 6, 30, tzinfo=timezone.utc)),
                ("FAC_ANGUL_DH", "MED_AMOX_500", 1200, "capsules", "BATCH-AMX-2402", datetime(2026, 12, 31, tzinfo=timezone.utc)),
                ("FAC_ANGUL_DH", "MED_METF_500", 1800, "tablets", "BATCH-MTF-2403", datetime(2027, 3, 31, tzinfo=timezone.utc)),
                ("FAC_ANGUL_DH", "MED_AMLO_5", 1400, "tablets", "BATCH-AML-2404", datetime(2027, 8, 31, tzinfo=timezone.utc)),
                ("FAC_ANGUL_DH", "MED_CETI_10", 950, "tablets", "BATCH-CTZ-2405", datetime(2026, 11, 30, tzinfo=timezone.utc)),
                ("FAC_ANGUL_DH", "MED_ORS_20", 3000, "sachets", "BATCH-ORS-2406", datetime(2027, 10, 31, tzinfo=timezone.utc)),
                ("FAC_ANGUL_DH", "MED_AZITH_500", 800, "tablets", "BATCH-AZM-2407", datetime(2026, 9, 30, tzinfo=timezone.utc)),
                ("FAC_ANGUL_DH", "MED_PANTO_40", 1600, "tablets", "BATCH-PAN-2408", datetime(2027, 5, 31, tzinfo=timezone.utc)),

                ("FAC_CHHENDIPADA_CHC", "MED_PARA_500", 1200, "tablets", "BATCH-PCM-2401", datetime(2027, 6, 30, tzinfo=timezone.utc)),
                ("FAC_CHHENDIPADA_CHC", "MED_AMOX_500", 600, "capsules", "BATCH-AMX-2402", datetime(2026, 12, 31, tzinfo=timezone.utc)),
                ("FAC_CHHENDIPADA_CHC", "MED_ORS_20", 1500, "sachets", "BATCH-ORS-2406", datetime(2027, 10, 31, tzinfo=timezone.utc)),
                ("FAC_CHHENDIPADA_CHC", "MED_CETI_10", 400, "tablets", "BATCH-CTZ-2405", datetime(2026, 11, 30, tzinfo=timezone.utc)),

                ("FAC_TALCHER_PHC", "MED_PARA_500", 800, "tablets", "BATCH-PCM-2401", datetime(2027, 6, 30, tzinfo=timezone.utc)),
                ("FAC_TALCHER_PHC", "MED_ORS_20", 1000, "sachets", "BATCH-ORS-2406", datetime(2027, 10, 31, tzinfo=timezone.utc)),
                ("FAC_TALCHER_PHC", "MED_AMLO_5", 500, "tablets", "BATCH-AML-2404", datetime(2027, 8, 31, tzinfo=timezone.utc)),
            ]

            for fid, mid, qty, unit, batch, exp in inventories_data:
                inv = FacilityInventory(
                    facility_id=fid,
                    medicine_id=mid,
                    quantity=qty,
                    unit=unit,
                    batch_number=batch,
                    expiry_date=exp,
                )
                db.add(inv)
            db.flush()

            # Referrals (sample clinical cases)
            sample_referrals = [
                {
                    "id": "REF_2026_001",
                    "patient_id": "P_101",
                    "patient_name": "Sarat Chandra Nayak",
                    "source_facility_id": chhendi_chc.id,
                    "destination_facility_id": angul_dh.id,
                    "reason": "Acute chest discomfort, ST changes on ECG, needs Cardiology consult",
                    "required_specialization": "Cardiology",
                    "required_diagnostic": "ECG (12-Lead Electrocardiogram)",
                    "required_medicine": "Amlodipine 5mg",
                    "priority": ReferralPriority.URGENT,
                    "status": ReferralStatus.ACCEPTED,
                    "notes": "Patient stabilized at CHC, ambulance dispatched with paramedic.",
                },
                {
                    "id": "REF_2026_002",
                    "patient_id": "P_102",
                    "patient_name": "Gitanjali Mohapatra",
                    "source_facility_id": talcher_phc.id,
                    "destination_facility_id": angul_dh.id,
                    "reason": "Third trimester pregnancy with mild preeclampsia, requires specialist ultrasound",
                    "required_specialization": "Gynecology",
                    "required_diagnostic": "Ultrasound Whole Abdomen",
                    "required_medicine": None,
                    "priority": ReferralPriority.ROUTINE,
                    "status": ReferralStatus.IN_PROGRESS,
                    "notes": "Transport arranged via 102 Janani Shishu ambulance.",
                },
                {
                    "id": "REF_2026_003",
                    "patient_id": "P_103",
                    "patient_name": "Pratap Rout",
                    "source_facility_id": angul_dh.id,
                    "destination_facility_id": bbsr_dh.id,
                    "reason": "Severe head injury post road traffic accident, requires CT Brain & Neurosurgery",
                    "required_specialization": "Neurology",
                    "required_diagnostic": None,
                    "required_medicine": None,
                    "priority": ReferralPriority.EMERGENCY,
                    "status": ReferralStatus.CREATED,
                    "notes": "Advanced Life Support (ALS) 108 ambulance requisitioned.",
                },
            ]

            for r_data in sample_referrals:
                ref = Referral(**r_data)
                db.add(ref)
            db.flush()

            db.commit()
            print("Healthcare network data seeded successfully!")
        else:
            print(f"Healthcare network already seeded ({fac_count} facilities).")

    except Exception as e:
        db.rollback()
        print(f"Error seeding healthcare network: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_healthcare_network()
