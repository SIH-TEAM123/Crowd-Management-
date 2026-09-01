from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.hospital import Hospital
from app.schemas.hospital import HospitalResponse
from app.services.hospital import calculate_distance_km


router = APIRouter(
    prefix="/hospitals",
    tags=["Hospitals"]
)


@router.get(
    "",
    response_model=list[HospitalResponse]
)
async def get_hospitals(
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(
        select(Hospital)
    )

    hospitals = result.scalars().all()

    return hospitals


@router.get(
    "/nearby"
)
async def get_nearby_hospitals(
    latitude: float,
    longitude: float,
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(
        select(Hospital)
    )

    hospitals = result.scalars().all()

    nearby_hospitals = []

    for hospital in hospitals:

        distance = calculate_distance_km(
            latitude,
            longitude,
            hospital.latitude,
            hospital.longitude
        )

        nearby_hospitals.append({

            "hospital_id": hospital.hospital_id,

            "name": hospital.name,

            "address": hospital.address,

            "latitude": hospital.latitude,

            "longitude": hospital.longitude,

            "distance_km": distance
        })

    nearby_hospitals.sort(
        key=lambda hospital: hospital["distance_km"]
    )

    return {
        "user_location": {
            "latitude": latitude,
            "longitude": longitude
        },
        "hospitals": nearby_hospitals
    }