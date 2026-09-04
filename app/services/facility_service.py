"""Facility service providing CRUD, validation, discovery, and Haversine distance calculations."""

import math
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.facility import Facility, FacilityType
from app.schemas.facility import FacilityCreate, FacilityUpdate

EARTH_RADIUS_KM = 6371.0


def calculate_haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """Calculate the great-circle distance between two geographic coordinates using the Haversine formula.

    Formula:
        a = sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)
        c = 2 * atan2(√a, √(1-a))
        distance = R * c

    Args:
        lat1: Latitude of point 1 in decimal degrees (-90.0 to 90.0).
        lon1: Longitude of point 1 in decimal degrees (-180.0 to 180.0).
        lat2: Latitude of point 2 in decimal degrees (-90.0 to 90.0).
        lon2: Longitude of point 2 in decimal degrees (-180.0 to 180.0).

    Returns:
        float: Great-circle distance in kilometers.
    """
    if lat1 == lat2 and lon1 == lon2:
        return 0.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )

    # Clamp a to [0.0, 1.0] for numerical stability
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return round(EARTH_RADIUS_KM * c, 3)


class FacilityService:
    """Reusable business logic service for healthcare facility management and discovery."""

    @staticmethod
    def create_facility(db: Session, facility_in: FacilityCreate) -> Facility:
        """Create a new facility in the database."""
        db_facility = Facility(
            id=facility_in.id or None,
            name=facility_in.name,
            facility_type=facility_in.facility_type,
            address=facility_in.address,
            latitude=facility_in.latitude,
            longitude=facility_in.longitude,
            contact_phone=facility_in.contact_phone,
            contact_email=facility_in.contact_email,
            contact_info=facility_in.contact_info,
            is_active=facility_in.is_active,
        )
        db.add(db_facility)
        db.commit()
        db.refresh(db_facility)
        return db_facility

    @staticmethod
    def get_by_id(db: Session, facility_id: str) -> Optional[Facility]:
        """Fetch a single facility by its unique identifier."""
        return db.query(Facility).filter(Facility.id == facility_id).first()

    # Convenience alias
    get_facility_by_id = get_by_id

    @staticmethod
    def get_facilities(
        db: Session,
        facility_type: Optional[FacilityType] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Facility]:
        """Query facilities with optional filtering by type and active status."""
        query = db.query(Facility)

        if facility_type is not None:
            query = query.filter(Facility.facility_type == facility_type)

        if is_active is not None:
            query = query.filter(Facility.is_active == is_active)

        return query.offset(skip).limit(limit).all()

    @staticmethod
    def update_facility(
        db: Session, facility_id: str, facility_in: FacilityUpdate
    ) -> Optional[Facility]:
        """Update an existing facility with provided fields."""
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        if not facility:
            return None

        update_dict = facility_in.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(facility, field, value)

        db.commit()
        db.refresh(facility)
        return facility

    @staticmethod
    def delete_facility(
        db: Session, facility_id: str, soft_delete: bool = True
    ) -> bool:
        """Delete or deactivate a facility."""
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        if not facility:
            return False

        if soft_delete:
            facility.is_active = False
            db.commit()
        else:
            db.delete(facility)
            db.commit()

        return True

    @staticmethod
    def discover_facilities(
        db: Session,
        user_lat: Optional[float] = None,
        user_lon: Optional[float] = None,
        facility_type: Optional[FacilityType] = None,
        max_distance_km: Optional[float] = None,
        is_active: bool = True,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Discover facilities by type, active status, and geographic proximity using Haversine distance.

        Args:
            db: Database session.
            user_lat: User/origin latitude in degrees.
            user_lon: User/origin longitude in degrees.
            facility_type: Filter by specific healthcare tier.
            max_distance_km: Maximum radius in kilometers.
            is_active: Filter active facilities only (default True).
            skip: Pagination offset.
            limit: Pagination limit.

        Returns:
            List of dictionaries with facility attributes and 'distance_km'.
        """
        query = db.query(Facility).filter(Facility.is_active == is_active)

        if facility_type is not None:
            query = query.filter(Facility.facility_type == facility_type)

        facilities = query.all()

        results: List[Dict[str, Any]] = []

        for fac in facilities:
            dist = None
            if user_lat is not None and user_lon is not None:
                dist = calculate_haversine_distance(
                    user_lat, user_lon, fac.latitude, fac.longitude
                )
                if max_distance_km is not None and dist > max_distance_km:
                    continue

            results.append(
                {
                    "id": fac.id,
                    "name": fac.name,
                    "facility_type": fac.facility_type,
                    "address": fac.address,
                    "latitude": fac.latitude,
                    "longitude": fac.longitude,
                    "contact_phone": fac.contact_phone,
                    "contact_email": fac.contact_email,
                    "contact_info": fac.contact_info,
                    "is_active": fac.is_active,
                    "created_at": fac.created_at,
                    "updated_at": fac.updated_at,
                    "distance_km": dist,
                }
            )

        # Sort by distance if user location provided
        if user_lat is not None and user_lon is not None:
            results.sort(key=lambda item: item["distance_km"] if item["distance_km"] is not None else float("inf"))

        return results[skip : skip + limit]
