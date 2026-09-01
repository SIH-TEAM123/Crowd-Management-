from sqlalchemy import select

from app.database import Base, engine, SessionLocal
from app.models.hospital import Hospital


HOSPITALS = [
    # =========================
    # PURI
    # =========================
    {
        "hospital_id": "H001",
        "name": "District Headquarters Hospital, Puri",
        "address": "Puri, Odisha, India",
        "latitude": 19.8135,
        "longitude": 85.8312,
    },
    {
        "hospital_id": "H002",
        "name": "E-24 Hospital",
        "address": "Puri, Odisha, India",
        "latitude": 19.80169,
        "longitude": 85.82413,
    },
    {
        "hospital_id": "H003",
        "name": "K.D.M.M. Hospital",
        "address": "Puri, Odisha, India",
        "latitude": 19.80504,
        "longitude": 85.83599,
    },
    {
        "hospital_id": "H004",
        "name": "Government Hospital, Puri",
        "address": "Puri, Odisha, India",
        "latitude": 19.8144,
        "longitude": 85.8296,
    },
    {
        "hospital_id": "H005",
        "name": "Kalara Hospital",
        "address": "Puri, Odisha, India",
        "latitude": 19.81249,
        "longitude": 85.8346,
    },

    # =========================
    # CUTTACK
    # =========================
    {
        "hospital_id": "H006",
        "name": "SCB Medical College & Hospital",
        "address": "Mangalabag, Cuttack, Odisha, India",
        "latitude": 20.4739,
        "longitude": 85.8915,
    },
    {
        "hospital_id": "H007",
        "name": "City Hospital, Cuttack",
        "address": "Cuttack, Odisha, India",
        "latitude": 20.4662,
        "longitude": 85.8708,
    },
    {
        "hospital_id": "H008",
        "name": "HCG Panda Curie Cancer Hospital",
        "address": "Cuttack, Odisha, India",
        "latitude": 20.38724,
        "longitude": 85.88669,
    },
    {
        "hospital_id": "H009",
        "name": "Moon Hospitals",
        "address": "Cuttack, Odisha, India",
        "latitude": 20.46379,
        "longitude": 85.91097,
    },

    # =========================
    # BHUBANESWAR
    # =========================
    {
        "hospital_id": "H010",
        "name": "AIIMS Bhubaneswar",
        "address": "Patrapada, Bhubaneswar, Odisha, India",
        "latitude": 20.23125,
        "longitude": 85.77407,
    },
    {
        "hospital_id": "H011",
        "name": "Capital Hospital",
        "address": "Unit 6, Bhubaneswar, Odisha, India",
        "latitude": 20.26013,
        "longitude": 85.82271,
    },
    {
        "hospital_id": "H012",
        "name": "Apollo Hospitals Bhubaneswar",
        "address": "Bhubaneswar, Odisha, India",
        "latitude": 20.3156345,
        "longitude": 85.8348463,
    },
    {
        "hospital_id": "H013",
        "name": "Kalinga Institute of Medical Sciences (KIMS)",
        "address": "Patia, Bhubaneswar, Odisha, India",
        "latitude": 20.353368,
        "longitude": 85.815437,
    },
    {
        "hospital_id": "H014",
        "name": "IMS & SUM Hospital",
        "address": "K8, Kalinga Nagar, Bhubaneswar, Odisha, India",
        "latitude": 20.28348,
        "longitude": 85.76966,
    },
    {
        "hospital_id": "H015",
        "name": "Kalinga Hospital",
        "address": "Chandrasekharpur, Bhubaneswar, Odisha, India",
        "latitude": 20.313731,
        "longitude": 85.818693,
    },
    {
        "hospital_id": "H016",
        "name": "Hi-Tech Medical College & Hospital",
        "address": "Bhubaneswar, Odisha, India",
        "latitude": 20.303907,
        "longitude": 85.87846,
    },
    {
        "hospital_id": "H017",
        "name": "Aditya Care Hospital",
        "address": "Bhubaneswar, Odisha, India",
        "latitude": 20.32742,
        "longitude": 85.81541,
    },
    {
        "hospital_id": "H018",
        "name": "CARE Hospitals",
        "address": "Chandrasekharpur, Bhubaneswar, Odisha, India",
        "latitude": 20.32143,
        "longitude": 85.81286,
    },
    {
        "hospital_id": "H019",
        "name": "LV Prasad Eye Institute",
        "address": "Bhubaneswar, Odisha, India",
        "latitude": 20.3464,
        "longitude": 85.8163,
    },
    {
        "hospital_id": "H020",
        "name": "Ayush Hospital",
        "address": "Bhubaneswar, Odisha, India",
        "latitude": 20.2963945,
        "longitude": 85.834406,
    },
]


async def seed_hospitals():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        for data in HOSPITALS:
            result = await db.execute(
                select(Hospital).where(
                    Hospital.hospital_id == data["hospital_id"]
                )
            )

            hospital = result.scalar_one_or_none()

            if hospital:
                # Update existing hospital
                hospital.name = data["name"]
                hospital.address = data["address"]
                hospital.latitude = data["latitude"]
                hospital.longitude = data["longitude"]

                print(f"Updated: {data['name']}")

            else:
                # Insert new hospital
                hospital = Hospital(**data)
                db.add(hospital)

                print(f"Added: {data['name']}")

        await db.commit()

    print()
    print(f"Hospital seeding completed: {len(HOSPITALS)} hospitals")


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed_hospitals())