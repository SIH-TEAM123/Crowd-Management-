"""FastAPI route handlers for OPD Department management and facility department discovery."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import require_admin_or_operator
from app.database import get_sync_db
from app.schemas.department import DepartmentCreate, DepartmentResponse
from app.services.department_service import DepartmentService

router = APIRouter(tags=["Departments"])


@router.get(
    "/facilities/{facility_id}/departments",
    response_model=List[DepartmentResponse],
    summary="List all active OPD departments for a facility",
)
def get_facility_departments(
    facility_id: str,
    db: Session = Depends(get_sync_db),
):
    """Retrieve all active OPD clinical departments available at the specified facility."""
    try:
        departments = DepartmentService.get_facility_departments(db, facility_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )
    return departments


@router.post(
    "/facilities/{facility_id}/departments",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new department in a facility (Protected)",
)
def create_facility_department(
    facility_id: str,
    dept_in: DepartmentCreate,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Create a new clinical department for a facility. Requires admin or operator credentials."""
    dept_in.facility_id = facility_id
    try:
        department = DepartmentService.create_department(db, dept_in)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )
    return department


@router.get(
    "/departments/{department_id}",
    response_model=DepartmentResponse,
    summary="Get department details by ID",
)
def get_department(
    department_id: str,
    db: Session = Depends(get_sync_db),
):
    """Retrieve details of an individual clinical department."""
    dept = DepartmentService.get_by_id(db, department_id)
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID '{department_id}' not found.",
        )
    return dept
