"""Medicine catalog and Facility Inventory Service with Safe Transactional Stock Management."""

from typing import Any, Dict, List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.facility import Facility
from app.models.medicine import FacilityInventory, Medicine
from app.schemas.medicine import (
    FacilityInventoryCreate,
    FacilityInventoryUpdate,
    MedicineCreate,
    MedicineUpdate,
)
from app.services.facility_service import calculate_haversine_distance


class MedicineService:
    """Service layer managing pharmaceutical catalog and transactional facility stock."""

    # -------------------------------------------------------------------------
    # 1. Medicine Catalog Operations
    # -------------------------------------------------------------------------

    @staticmethod
    def create_medicine(db: Session, medicine_in: MedicineCreate) -> Medicine:
        """Register a new pharmaceutical product in the global catalog."""
        db_med = Medicine(
            id=medicine_in.id or None,
            name=medicine_in.name,
            generic_name=medicine_in.generic_name,
            dosage_form=medicine_in.dosage_form,
            strength=medicine_in.strength,
            manufacturer=medicine_in.manufacturer,
        )
        db.add(db_med)
        db.commit()
        db.refresh(db_med)
        return db_med

    @staticmethod
    def get_medicine_by_id(db: Session, medicine_id: str) -> Optional[Medicine]:
        """Fetch medicine by unique product identifier."""
        return db.query(Medicine).filter(Medicine.id == medicine_id).first()

    @staticmethod
    def get_medicines(
        db: Session,
        query: Optional[str] = None,
        generic_name: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Medicine]:
        """Search and list medicines by brand name, generic name, or keyword."""
        q = db.query(Medicine)

        if query:
            search_pattern = f"%{query.strip()}%"
            q = q.filter(
                or_(
                    Medicine.name.ilike(search_pattern),
                    Medicine.generic_name.ilike(search_pattern),
                )
            )

        if generic_name:
            q = q.filter(Medicine.generic_name.ilike(f"%{generic_name.strip()}%"))

        return q.offset(skip).limit(limit).all()

    @staticmethod
    def update_medicine(
        db: Session, medicine_id: str, medicine_in: MedicineUpdate
    ) -> Optional[Medicine]:
        """Update medicine catalog metadata."""
        med = db.query(Medicine).filter(Medicine.id == medicine_id).first()
        if not med:
            return None

        update_dict = medicine_in.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(med, field, value)

        db.commit()
        db.refresh(med)
        return med

    @staticmethod
    def delete_medicine(db: Session, medicine_id: str) -> bool:
        """Remove a medicine from catalog."""
        med = db.query(Medicine).filter(Medicine.id == medicine_id).first()
        if not med:
            return False

        db.delete(med)
        db.commit()
        return True

    # -------------------------------------------------------------------------
    # 2. Facility Inventory Operations
    # -------------------------------------------------------------------------

    @staticmethod
    def set_or_update_inventory(
        db: Session, inv_in: FacilityInventoryCreate
    ) -> FacilityInventory:
        """Initialize or overwrite medicine inventory stock for a facility.

        Raises:
            ValueError: If referenced facility or medicine does not exist, or quantity < 0.
        """
        if inv_in.quantity < 0:
            raise ValueError("Inventory stock quantity cannot be negative.")

        facility = db.query(Facility).filter(Facility.id == inv_in.facility_id).first()
        if not facility:
            raise ValueError(f"Facility with ID '{inv_in.facility_id}' does not exist.")

        medicine = db.query(Medicine).filter(Medicine.id == inv_in.medicine_id).first()
        if not medicine:
            raise ValueError(f"Medicine with ID '{inv_in.medicine_id}' does not exist.")

        # Check existing inventory record
        inv = (
            db.query(FacilityInventory)
            .filter(
                FacilityInventory.facility_id == inv_in.facility_id,
                FacilityInventory.medicine_id == inv_in.medicine_id,
            )
            .first()
        )

        if inv:
            inv.quantity = inv_in.quantity
            inv.unit = inv_in.unit
            inv.batch_number = inv_in.batch_number
            inv.expiry_date = inv_in.expiry_date
        else:
            inv = FacilityInventory(
                id=inv_in.id or None,
                facility_id=inv_in.facility_id,
                medicine_id=inv_in.medicine_id,
                quantity=inv_in.quantity,
                unit=inv_in.unit,
                batch_number=inv_in.batch_number,
                expiry_date=inv_in.expiry_date,
            )
            db.add(inv)

        db.commit()
        db.refresh(inv)
        return inv

    @staticmethod
    def adjust_stock(
        db: Session,
        facility_id: str,
        medicine_id: str,
        delta: int,
    ) -> FacilityInventory:
        """Atomically restock (delta > 0) or dispense (delta < 0) medicine inventory.

        Guarantees stock cannot drop below zero.

        Raises:
            ValueError: If facility/medicine not found or insufficient stock for deduction.
        """
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        if not facility:
            raise ValueError(f"Facility with ID '{facility_id}' does not exist.")

        medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
        if not medicine:
            raise ValueError(f"Medicine with ID '{medicine_id}' does not exist.")

        inv = (
            db.query(FacilityInventory)
            .filter(
                FacilityInventory.facility_id == facility_id,
                FacilityInventory.medicine_id == medicine_id,
            )
            .first()
        )

        if not inv:
            if delta < 0:
                raise ValueError(
                    f"Cannot dispense {abs(delta)} units of '{medicine.name}'. "
                    f"No existing stock record at facility '{facility.name}'."
                )
            inv = FacilityInventory(
                facility_id=facility_id,
                medicine_id=medicine_id,
                quantity=0,
            )
            db.add(inv)

        new_quantity = inv.quantity + delta
        if new_quantity < 0:
            raise ValueError(
                f"Insufficient inventory for '{medicine.name}' at facility '{facility.name}'. "
                f"Current stock: {inv.quantity}, requested deduction: {abs(delta)}."
            )

        inv.quantity = new_quantity
        db.commit()
        db.refresh(inv)
        return inv

    @staticmethod
    def get_facility_inventory(
        db: Session,
        facility_id: str,
        is_available_only: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> List[FacilityInventory]:
        """Fetch all inventory records for a specific facility."""
        q = db.query(FacilityInventory).filter(FacilityInventory.facility_id == facility_id)

        if is_available_only:
            q = q.filter(FacilityInventory.quantity > 0)

        return q.offset(skip).limit(limit).all()

    @staticmethod
    def check_facility_medicine_stock(
        db: Session, facility_id: str, medicine_id: str
    ) -> Optional[FacilityInventory]:
        """Retrieve inventory status for a specific medicine at a facility."""
        return (
            db.query(FacilityInventory)
            .filter(
                FacilityInventory.facility_id == facility_id,
                FacilityInventory.medicine_id == medicine_id,
            )
            .first()
        )

    @staticmethod
    def find_facilities_with_medicine(
        db: Session,
        medicine_id: str,
        min_quantity: int = 1,
        user_lat: Optional[float] = None,
        user_lon: Optional[float] = None,
        max_distance_km: Optional[float] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Find all active healthcare facilities currently stocking a requested medicine.

        Optionally calculates Haversine proximity distance and filters by radius.
        """
        query = (
            db.query(FacilityInventory, Facility)
            .join(Facility, FacilityInventory.facility_id == Facility.id)
            .filter(
                FacilityInventory.medicine_id == medicine_id,
                FacilityInventory.quantity >= max(1, min_quantity),
                Facility.is_active.is_(True),
            )
        )

        records = query.all()
        results: List[Dict[str, Any]] = []

        for inv, fac in records:
            dist = None
            if user_lat is not None and user_lon is not None:
                dist = calculate_haversine_distance(
                    user_lat, user_lon, fac.latitude, fac.longitude
                )
                if max_distance_km is not None and dist > max_distance_km:
                    continue

            results.append(
                {
                    "facility_id": fac.id,
                    "facility_name": fac.name,
                    "facility_type": fac.facility_type.value if hasattr(fac.facility_type, "value") else str(fac.facility_type),
                    "address": fac.address,
                    "latitude": fac.latitude,
                    "longitude": fac.longitude,
                    "quantity": inv.quantity,
                    "unit": inv.unit,
                    "is_available": inv.is_available,
                    "availability_status": inv.availability_status,
                    "distance_km": dist,
                }
            )

        if user_lat is not None and user_lon is not None:
            results.sort(key=lambda item: item["distance_km"] if item["distance_km"] is not None else float("inf"))
        else:
            results.sort(key=lambda item: item["quantity"], reverse=True)

        return results[skip : skip + limit]
