"""FastAPI route handlers for Unified Facility Operational State and Live Camera Telemetry."""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_admin_or_operator
from app.database import get_sync_db
from app.schemas.operational_state import (
    CameraTelemetryPublish,
    CameraTelemetryResponse,
    FacilityOperationalState,
)
from app.services.facility_service import FacilityService
from app.services.operational_state_service import OperationalStateService

router = APIRouter(prefix="/facilities", tags=["Facility Operational State & Telemetry"])


@router.get(
    "/operational-state",
    response_model=List[FacilityOperationalState],
    summary="Retrieve real-time operational states across all facilities",
)
def get_all_facilities_operational_state(
    is_active_only: bool = Query(True, description="Filter only active facilities"),
    db: Session = Depends(get_sync_db),
):
    """Compile real-time operational states across healthcare network facilities."""
    return OperationalStateService.get_all_operational_states(
        db=db, is_active_only=is_active_only
    )


@router.get(
    "/{facility_id}/operational-state",
    response_model=FacilityOperationalState,
    summary="Retrieve unified real-time operational state for a specific facility",
)
def get_facility_operational_state(
    facility_id: str,
    db: Session = Depends(get_sync_db),
):
    """Retrieve unified operational state combining database state, queue, prediction, and camera telemetry.

    Strictly returns NULL for metrics lacking an authentic operational data source.
    """
    try:
        return OperationalStateService.get_facility_operational_state(
            db=db, facility_id=facility_id
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )


@router.post(
    "/{facility_id}/camera-telemetry",
    response_model=CameraTelemetryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Publish live camera crowd count telemetry for a facility (Protected)",
)
def publish_camera_telemetry(
    facility_id: str,
    telemetry_in: CameraTelemetryPublish,
    db: Session = Depends(get_sync_db),
    _token: str = Depends(require_admin_or_operator),
):
    """Ingest real-time crowd telemetry from YOLO/ByteTrack vision pipeline.

    Applies privacy sanitization.
    """
    fac = FacilityService.get_facility_by_id(db, facility_id)
    if not fac:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility with ID '{facility_id}' not found.",
        )

    sanitized = OperationalStateService.publish_camera_telemetry(
        facility_id=facility_id,
        telemetry_in=telemetry_in,
    )

    ts = (
        datetime.fromisoformat(sanitized["timestamp"])
        if isinstance(sanitized.get("timestamp"), str)
        else (telemetry_in.timestamp or datetime.now(timezone.utc))
    )

    return CameraTelemetryResponse(
        facility_id=facility_id,
        camera_id=sanitized.get("camera_id", telemetry_in.camera_id),
        people_count=sanitized.get("people_count", telemetry_in.people_count),
        timestamp=ts,
        location_type=sanitized.get("location_type", "waiting_area"),
    )
