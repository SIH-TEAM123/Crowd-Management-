"""
Seed exactly 70 healthcare facilities for VIZITOR.

20 existing hospital locations are represented as Facility records.
50 additional facilities are added across Odisha.

Safe to rerun:
- Existing managed facilities are updated.
- Missing facilities are inserted.
- No duplicate managed facilities are created.
"""

from datetime import datetime, timezone

from sqlalchemy import select

from app.database import Base, engine, SessionLocal
from app.models.facility import Facility, FacilityType
from app.models.specialist import Specialist, AvailabilityStatus
from app.models.diagnostic import DiagnosticTest
from app.models.medicine import Medicine, FacilityInventory


FACILITIES = [
    # Existing 20 hospital locations
    ("H001", "District Headquarters Hospital, Puri", FacilityType.DISTRICT_HOSPITAL,
     "Puri, Odisha, India", 19.8135, 85.8312),
    ("H002", "E-24 Hospital", FacilityType.RURAL_HOSPITAL,
     "Puri, Odisha, India", 19.80169, 85.82413),
    ("H003", "K.D.M.M. Hospital", FacilityType.RURAL_HOSPITAL,
     "Puri, Odisha, India", 19.80504, 85.83599),
    ("H004", "Government Hospital, Puri", FacilityType.DISTRICT_HOSPITAL,
     "Puri, Odisha, India", 19.8144, 85.8296),
    ("H005", "Kalara Hospital", FacilityType.RURAL_HOSPITAL,
     "Puri, Odisha, India", 19.81249, 85.8346),

    ("H006", "SCB Medical College & Hospital", FacilityType.DISTRICT_HOSPITAL,
     "Mangalabag, Cuttack, Odisha, India", 20.4739, 85.8915),
    ("H007", "City Hospital, Cuttack", FacilityType.DISTRICT_HOSPITAL,
     "Cuttack, Odisha, India", 20.4662, 85.8708),
    ("H008", "HCG Panda Curie Cancer Hospital", FacilityType.DISTRICT_HOSPITAL,
     "Cuttack, Odisha, India", 20.38724, 85.88669),
    ("H009", "Moon Hospitals", FacilityType.RURAL_HOSPITAL,
     "Cuttack, Odisha, India", 20.46379, 85.91097),

    ("H010", "AIIMS Bhubaneswar", FacilityType.DISTRICT_HOSPITAL,
     "Patrapada, Bhubaneswar, Odisha, India", 20.23125, 85.77407),
    ("H011", "Capital Hospital", FacilityType.DISTRICT_HOSPITAL,
     "Unit 6, Bhubaneswar, Odisha, India", 20.26013, 85.82271),
    ("H012", "Apollo Hospitals Bhubaneswar", FacilityType.DISTRICT_HOSPITAL,
     "Bhubaneswar, Odisha, India", 20.3156345, 85.8348463),
    ("H013", "Kalinga Institute of Medical Sciences (KIMS)", FacilityType.DISTRICT_HOSPITAL,
     "Patia, Bhubaneswar, Odisha, India", 20.353368, 85.815437),
    ("H014", "IMS & SUM Hospital", FacilityType.DISTRICT_HOSPITAL,
     "Kalinga Nagar, Bhubaneswar, Odisha, India", 20.28348, 85.76966),
    ("H015", "Kalinga Hospital", FacilityType.DISTRICT_HOSPITAL,
     "Chandrasekharpur, Bhubaneswar, Odisha, India", 20.313731, 85.818693),
    ("H016", "Hi-Tech Medical College & Hospital", FacilityType.DISTRICT_HOSPITAL,
     "Bhubaneswar, Odisha, India", 20.303907, 85.87846),
    ("H017", "Aditya Care Hospital", FacilityType.RURAL_HOSPITAL,
     "Bhubaneswar, Odisha, India", 20.32742, 85.81541),
    ("H018", "CARE Hospitals", FacilityType.DISTRICT_HOSPITAL,
     "Chandrasekharpur, Bhubaneswar, Odisha, India", 20.32143, 85.81286),
    ("H019", "LV Prasad Eye Institute", FacilityType.DISTRICT_HOSPITAL,
     "Bhubaneswar, Odisha, India", 20.3464, 85.8163),
    ("H020", "Ayush Hospital", FacilityType.RURAL_HOSPITAL,
     "Bhubaneswar, Odisha, India", 20.2963945, 85.834406),

    # 50 additional facilities
    ("F021", "Khordha District Hospital", FacilityType.DISTRICT_HOSPITAL,
     "Khordha, Odisha, India", 20.1827, 85.6167),
    ("F022", "Jatni Community Hospital", FacilityType.RURAL_HOSPITAL,
     "Jatni, Khordha, Odisha, India", 20.1597, 85.7073),
    ("F023", "Balianta PHC", FacilityType.PHC,
     "Balianta, Khordha, Odisha, India", 20.2268, 85.8490),
    ("F024", "Balipatna PHC", FacilityType.PHC,
     "Balipatna, Khordha, Odisha, India", 20.1466, 85.8165),
    ("F025", "Nimapara Community Hospital", FacilityType.RURAL_HOSPITAL,
     "Nimapara, Puri, Odisha, India", 20.0571, 86.0040),
    ("F026", "Pipili Community Health Centre", FacilityType.RURAL_HOSPITAL,
     "Pipili, Puri, Odisha, India", 20.1136, 85.8312),
    ("F027", "Konark Community Health Centre", FacilityType.RURAL_HOSPITAL,
     "Konark, Puri, Odisha, India", 19.8876, 86.0945),
    ("F028", "Satyabadi PHC", FacilityType.PHC,
     "Satyabadi, Puri, Odisha, India", 19.8941, 85.8492),
    ("F029", "Kakatpur PHC", FacilityType.PHC,
     "Kakatpur, Puri, Odisha, India", 19.9720, 86.1078),
    ("F030", "Delanga PHC", FacilityType.PHC,
     "Delanga, Puri, Odisha, India", 20.0060, 85.8480),

    ("F031", "Jagatsinghpur District Hospital", FacilityType.DISTRICT_HOSPITAL,
     "Jagatsinghpur, Odisha, India", 20.2557, 86.1711),
    ("F032", "Paradip Community Hospital", FacilityType.RURAL_HOSPITAL,
     "Paradip, Odisha, India", 20.3160, 86.6085),
    ("F033", "Kujang CHC", FacilityType.RURAL_HOSPITAL,
     "Kujang, Jagatsinghpur, Odisha, India", 20.3105, 86.3590),
    ("F034", "Tirtol CHC", FacilityType.RURAL_HOSPITAL,
     "Tirtol, Jagatsinghpur, Odisha, India", 20.3188, 86.2660),
    ("F035", "Balikuda PHC", FacilityType.PHC,
     "Balikuda, Jagatsinghpur, Odisha, India", 20.1550, 86.1930),

    ("F036", "Kendrapara District Hospital", FacilityType.DISTRICT_HOSPITAL,
     "Kendrapara, Odisha, India", 20.5000, 86.4200),
    ("F037", "Pattamundai CHC", FacilityType.RURAL_HOSPITAL,
     "Pattamundai, Kendrapara, Odisha, India", 20.5740, 86.5600),
    ("F038", "Aul CHC", FacilityType.RURAL_HOSPITAL,
     "Aul, Kendrapara, Odisha, India", 20.6650, 86.6000),
    ("F039", "Rajnagar CHC", FacilityType.RURAL_HOSPITAL,
     "Rajnagar, Kendrapara, Odisha, India", 20.6430, 86.7000),
    ("F040", "Mahakalapada CHC", FacilityType.RURAL_HOSPITAL,
     "Mahakalapada, Kendrapara, Odisha, India", 20.4860, 86.6510),

    ("F041", "Dhenkanal District Hospital", FacilityType.DISTRICT_HOSPITAL,
     "Dhenkanal, Odisha, India", 20.6600, 85.6000),
    ("F042", "Hindol CHC", FacilityType.RURAL_HOSPITAL,
     "Hindol, Dhenkanal, Odisha, India", 20.6100, 85.2900),
    ("F043", "Kamakhyanagar CHC", FacilityType.RURAL_HOSPITAL,
     "Kamakhyanagar, Odisha, India", 20.9300, 85.5600),
    ("F044", "Bhuban CHC", FacilityType.RURAL_HOSPITAL,
     "Bhuban, Dhenkanal, Odisha, India", 20.8800, 85.8300),
    ("F045", "Gondia PHC", FacilityType.PHC,
     "Gondia, Dhenkanal, Odisha, India", 20.7600, 85.6100),

    ("F046", "Angul District Hospital", FacilityType.DISTRICT_HOSPITAL,
     "Angul, Odisha, India", 20.8409, 85.1010),
    ("F047", "Talcher Sub-Divisional Hospital", FacilityType.RURAL_HOSPITAL,
     "Talcher, Angul, Odisha, India", 20.9500, 85.2300),
    ("F048", "Chhendipada CHC", FacilityType.RURAL_HOSPITAL,
     "Chhendipada, Angul, Odisha, India", 20.6900, 85.2200),
    ("F049", "Banarpal PHC", FacilityType.PHC,
     "Banarpal, Angul, Odisha, India", 20.7700, 85.1900),
    ("F050", "Athmallik CHC", FacilityType.RURAL_HOSPITAL,
     "Athmallik, Angul, Odisha, India", 20.7300, 84.5300),

    ("F051", "Cuttack Rural Hospital", FacilityType.RURAL_HOSPITAL,
     "Cuttack Rural, Odisha, India", 20.5000, 85.8500),
    ("F052", "Niali CHC", FacilityType.RURAL_HOSPITAL,
     "Niali, Cuttack, Odisha, India", 20.0500, 86.0200),
    ("F053", "Salepur CHC", FacilityType.RURAL_HOSPITAL,
     "Salepur, Cuttack, Odisha, India", 20.4700, 86.1200),
    ("F054", "Banki Sub-Divisional Hospital", FacilityType.RURAL_HOSPITAL,
     "Banki, Cuttack, Odisha, India", 20.3800, 85.5300),
    ("F055", "Athagarh CHC", FacilityType.RURAL_HOSPITAL,
     "Athagarh, Cuttack, Odisha, India", 20.5200, 85.6200),

    ("F056", "Nayagarh District Hospital", FacilityType.DISTRICT_HOSPITAL,
     "Nayagarh, Odisha, India", 20.1300, 85.1000),
    ("F057", "Khandapada CHC", FacilityType.RURAL_HOSPITAL,
     "Khandapada, Nayagarh, Odisha, India", 20.2600, 85.1000),
    ("F058", "Ranpur CHC", FacilityType.RURAL_HOSPITAL,
     "Ranpur, Nayagarh, Odisha, India", 20.0800, 85.3200),
    ("F059", "Daspalla CHC", FacilityType.RURAL_HOSPITAL,
     "Daspalla, Nayagarh, Odisha, India", 20.3700, 84.8500),
    ("F060", "Odagaon CHC", FacilityType.RURAL_HOSPITAL,
     "Odagaon, Nayagarh, Odisha, India", 20.0200, 85.0700),

    ("F061", "Puri Sadar PHC", FacilityType.PHC,
     "Puri Sadar, Odisha, India", 19.8200, 85.8500),
    ("F062", "Gop CHC", FacilityType.RURAL_HOSPITAL,
     "Gop, Puri, Odisha, India", 19.9700, 86.0800),
    ("F063", "Brahmagiri CHC", FacilityType.RURAL_HOSPITAL,
     "Brahmagiri, Puri, Odisha, India", 19.8000, 85.6400),
    ("F064", "Krushnaprasad PHC", FacilityType.PHC,
     "Krushnaprasad, Puri, Odisha, India", 19.9300, 86.5300),
    ("F065", "Raghurajpur PHC", FacilityType.PHC,
     "Raghurajpur, Puri, Odisha, India", 19.9000, 85.8400),

    ("F066", "Bhubaneswar North PHC", FacilityType.PHC,
     "North Bhubaneswar, Odisha, India", 20.3400, 85.8500),
    ("F067", "Bhubaneswar South PHC", FacilityType.PHC,
     "South Bhubaneswar, Odisha, India", 20.2200, 85.8200),
    ("F068", "Bhubaneswar East PHC", FacilityType.PHC,
     "East Bhubaneswar, Odisha, India", 20.3000, 85.8700),
    ("F069", "Bhubaneswar West PHC", FacilityType.PHC,
     "West Bhubaneswar, Odisha, India", 20.2900, 85.7500),
    ("F070", "Patia Community Hospital", FacilityType.RURAL_HOSPITAL,
     "Patia, Bhubaneswar, Odisha, India", 20.3500, 85.8200),
]


SPECIALIZATIONS = [
    "General Medicine",
    "Emergency Medicine",
    "Cardiology",
    "Pediatrics",
    "Gynecology",
    "Orthopedics",
    "Dermatology",
    "ENT",
    "Ophthalmology",
    "Neurology",
]


DIAGNOSTICS = [
    ("CBC", "Pathology"),
    ("Blood Glucose", "Pathology"),
    ("Liver Function Test", "Biochemistry"),
    ("Kidney Function Test", "Biochemistry"),
    ("X-Ray", "Imaging"),
    ("Ultrasound", "Imaging"),
    ("ECG", "Cardiology"),
]


MEDICINES = [
    ("Paracetamol 500mg", "Paracetamol", "Tablet", "500mg"),
    ("Amoxicillin 500mg", "Amoxicillin", "Capsule", "500mg"),
    ("Azithromycin 500mg", "Azithromycin", "Tablet", "500mg"),
    ("ORS", "Oral Rehydration Salts", "Sachet", "21g"),
    ("Cetirizine 10mg", "Cetirizine", "Tablet", "10mg"),
]


def managed_facility_id(source_id: str) -> str:
    return f"VIZ_{source_id}"


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        medicine_map = {}

        # Medicine catalog
        for name, generic, form, strength in MEDICINES:
            result = await db.execute(
                select(Medicine).where(Medicine.name == name)
            )
            medicine = result.scalar_one_or_none()

            if medicine is None:
                medicine = Medicine(
                    name=name,
                    generic_name=generic,
                    dosage_form=form,
                    strength=strength,
                    manufacturer="VIZITOR Network",
                )
                db.add(medicine)
                await db.flush()

            medicine_map[name] = medicine

        # Facilities + related healthcare capability data
        for source_id, name, facility_type, address, lat, lon in FACILITIES:
            facility_id = managed_facility_id(source_id)

            result = await db.execute(
                select(Facility).where(Facility.id == facility_id)
            )
            facility = result.scalar_one_or_none()

            if facility is None:
                facility = Facility(id=facility_id)
                db.add(facility)

            facility.name = name
            facility.facility_type = facility_type
            facility.address = address
            facility.latitude = lat
            facility.longitude = lon
            facility.contact_phone = "1800-123-4567"
            facility.contact_email = "support@vizitor.health"
            facility.is_active = True

            await db.flush()

            # Specialists
            existing_specs = await db.execute(
                select(Specialist).where(
                    Specialist.facility_id == facility.id
                )
            )

            existing_spec_names = {
                row.specialization
                for row in existing_specs.scalars().all()
            }

            # Every facility gets core services; larger hospitals get more.
            selected_specs = SPECIALIZATIONS[:4]

            if facility_type == FacilityType.DISTRICT_HOSPITAL:
                selected_specs = SPECIALIZATIONS

            for specialization in selected_specs:
                if specialization in existing_spec_names:
                    continue

                db.add(
                    Specialist(
                        name=f"{specialization} Specialist - {name}",
                        specialization=specialization,
                        department=specialization,
                        facility_id=facility.id,
                        availability_status=AvailabilityStatus.AVAILABLE,
                        schedule_info="OPD 09:00-17:00",
                        opd_start_time="09:00",
                        opd_end_time="17:00",
                        slot_duration_minutes=15,
                        working_days="Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
                        break_start_time="13:00",
                        break_end_time="14:00",
                        is_schedule_active=True,
                    )
                )

            # Diagnostics
            existing_diags = await db.execute(
                select(DiagnosticTest).where(
                    DiagnosticTest.facility_id == facility.id
                )
            )

            existing_diag_names = {
                row.name for row in existing_diags.scalars().all()
            }

            selected_diags = DIAGNOSTICS if facility_type == FacilityType.DISTRICT_HOSPITAL else DIAGNOSTICS[:4]

            for diag_name, category in selected_diags:
                if diag_name in existing_diag_names:
                    continue

                db.add(
                    DiagnosticTest(
                        name=diag_name,
                        category=category,
                        facility_id=facility.id,
                        is_available=True,
                        description=f"{diag_name} available at {name}",
                        cost=250.0,
                        estimated_duration_minutes=30,
                    )
                )

            await db.flush()

            # Medicine inventory
            for medicine_name, medicine in medicine_map.items():
                result = await db.execute(
                    select(FacilityInventory).where(
                        FacilityInventory.facility_id == facility.id,
                        FacilityInventory.medicine_id == medicine.id,
                    )
                )

                inventory = result.scalar_one_or_none()

                if inventory is None:
                    inventory = FacilityInventory(
                        facility_id=facility.id,
                        medicine_id=medicine.id,
                        quantity=100 if facility_type == FacilityType.DISTRICT_HOSPITAL else 50,
                        unit="units",
                        batch_number="VIZ-2026",
                    )
                    db.add(inventory)

        await db.commit()

    print(f"SUCCESS: seeded {len(FACILITIES)} managed facilities.")


if __name__ == "__main__":
    import asyncio
    asyncio.run(seed())