"""Department service for managing OPD clinical departments within healthcare facilities."""

from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.department import Department
from app.models.facility import Facility
from app.models.specialist import Specialist
from app.schemas.department import DepartmentCreate


class DepartmentService:
    """Business logic service for OPD clinical departments."""

    @staticmethod
    def create_department(db: Session, dept_in: DepartmentCreate) -> Department:
        """Create a new clinical department for a facility.

        Raises:
            ValueError: If the referenced facility does not exist or duplicate name in facility.
        """
        facility = db.query(Facility).filter(Facility.id == dept_in.facility_id).first()
        if not facility:
            raise ValueError(f"Facility with ID '{dept_in.facility_id}' does not exist.")

        existing = (
            db.query(Department)
            .filter(
                Department.facility_id == dept_in.facility_id,
                Department.name.ilike(dept_in.name.strip()),
            )
            .first()
        )
        if existing:
            return existing

        dept = Department(
            id=dept_in.id or None,
            facility_id=dept_in.facility_id,
            name=dept_in.name.strip(),
            description=dept_in.description,
            is_active=dept_in.is_active,
        )
        db.add(dept)
        db.commit()
        db.refresh(dept)
        return dept

    @staticmethod
    def get_by_id(db: Session, department_id: str) -> Optional[Department]:
        """Fetch a department by unique ID."""
        return db.query(Department).filter(Department.id == department_id).first()

    @staticmethod
    def get_facility_departments(db: Session, facility_id: str) -> List[Department]:
        """Get all active departments for a given facility.

        Also ensures that any distinct departments configured on Specialists
        practicing at this facility are present as department entries.
        """
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        if not facility:
            raise ValueError(f"Facility with ID '{facility_id}' does not exist.")

        # Query explicit department rows
        dept_records = (
            db.query(Department)
            .filter(
                Department.facility_id == facility_id,
                Department.is_active.is_(True),
            )
            .order_by(Department.name.asc())
            .all()
        )
        existing_names = {d.name.strip().lower() for d in dept_records}

        # Auto-discover from specialists practicing at facility
        specialists = db.query(Specialist).filter(Specialist.facility_id == facility_id).all()
        created_any = False
        for spec in specialists:
            dept_name = (spec.department or spec.specialization or "").strip()
            if dept_name and dept_name.lower() not in existing_names:
                new_dept = Department(
                    facility_id=facility_id,
                    name=dept_name,
                    description=f"Auto-configured OPD department for {dept_name}",
                    is_active=True,
                )
                db.add(new_dept)
                existing_names.add(dept_name.lower())
                created_any = True

        if created_any:
            db.commit()
            dept_records = (
                db.query(Department)
                .filter(
                    Department.facility_id == facility_id,
                    Department.is_active.is_(True),
                )
                .order_by(Department.name.asc())
                .all()
            )

        return dept_records
