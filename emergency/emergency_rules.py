"""Emergency rules and validation logic for healthcare location emergency priority."""

from typing import Any, Dict, Optional, Set
from pydantic import BaseModel, Field

SUPPORTED_HEALTHCARE_LOCATIONS: Set[str] = {
    "hospital",
    "clinic",
    "health_center",
    "medical_center",
}

SUPPORTED_EMERGENCY_TYPES: Set[str] = {
    "critical_patient",
    "ambulance_arrival",
    "medical_emergency",
    "triage_overload",
}

SEVERITY_LEVELS: Dict[str, float] = {
    "critical": 1.0,
    "high": 0.8,
    "medium": 0.5,
    "low": 0.2,
}


class EmergencyEvent(BaseModel):
    """Data contract representing a healthcare emergency event."""

    location_id: str = Field("UNKNOWN", description="Identifier of the location/facility")
    location_type: str = Field("UNKNOWN", description="Facility type descriptor")
    emergency_active: bool = Field(False, description="Flag indicating active emergency")
    emergency_type: str = Field("UNKNOWN", description="Emergency classification type")
    severity: str = Field("low", description="Emergency severity level")
    eligible: bool = Field(False, description="Eligibility status for healthcare priority")
    reason: str = Field("", description="Human-readable rationale for eligibility decision")


def validate_emergency_event(data: Any) -> EmergencyEvent:
    """Validate raw emergency input data against healthcare safety rules.

    Args:
        data: Dict or EmergencyEvent payload containing emergency details.

    Returns:
        EmergencyEvent: Validated emergency event with eligibility status and rationale.
    """
    if data is None or not isinstance(data, dict):
        return EmergencyEvent(
            location_id="UNKNOWN",
            location_type="UNKNOWN",
            emergency_active=False,
            emergency_type="UNKNOWN",
            severity="low",
            eligible=False,
            reason="Invalid emergency input payload; input data must be a dictionary.",
        )

    loc_id = str(data.get("location_id", "UNKNOWN"))
    loc_type_raw = data.get("location_type")
    active = bool(data.get("emergency_active", False))
    type_raw = data.get("emergency_type")
    severity_raw = data.get("severity")

    # 1. Location type presence and healthcare validation
    if not loc_type_raw:
        return EmergencyEvent(
            location_id=loc_id,
            location_type="UNKNOWN",
            emergency_active=active,
            emergency_type=str(type_raw or "UNKNOWN"),
            severity=str(severity_raw or "low"),
            eligible=False,
            reason="Location type is missing from emergency request.",
        )

    loc_type = str(loc_type_raw).strip().lower()

    if loc_type not in SUPPORTED_HEALTHCARE_LOCATIONS:
        return EmergencyEvent(
            location_id=loc_id,
            location_type=str(loc_type_raw),
            emergency_active=active,
            emergency_type=str(type_raw or "UNKNOWN"),
            severity=str(severity_raw or "low"),
            eligible=False,
            reason=f"Location type '{loc_type_raw}' is not eligible for healthcare emergency priority.",
        )

    # 2. Emergency active flag check
    if not active:
        return EmergencyEvent(
            location_id=loc_id,
            location_type=str(loc_type_raw),
            emergency_active=False,
            emergency_type=str(type_raw or "UNKNOWN"),
            severity=str(severity_raw or "low"),
            eligible=False,
            reason="Emergency state is not active.",
        )

    # 3. Emergency classification type validation
    if not type_raw:
        return EmergencyEvent(
            location_id=loc_id,
            location_type=str(loc_type_raw),
            emergency_active=True,
            emergency_type="UNKNOWN",
            severity=str(severity_raw or "low"),
            eligible=False,
            reason="Emergency type is missing.",
        )

    em_type = str(type_raw).strip().lower()

    if em_type not in SUPPORTED_EMERGENCY_TYPES:
        return EmergencyEvent(
            location_id=loc_id,
            location_type=str(loc_type_raw),
            emergency_active=True,
            emergency_type=str(type_raw),
            severity=str(severity_raw or "low"),
            eligible=False,
            reason=f"Emergency type '{type_raw}' is not supported.",
        )

    # 4. Severity level validation
    if not severity_raw:
        return EmergencyEvent(
            location_id=loc_id,
            location_type=str(loc_type_raw),
            emergency_active=True,
            emergency_type=str(type_raw),
            severity="UNKNOWN",
            eligible=False,
            reason="Emergency severity level is missing.",
        )

    sev = str(severity_raw).strip().lower()

    if sev not in SEVERITY_LEVELS:
        return EmergencyEvent(
            location_id=loc_id,
            location_type=str(loc_type_raw),
            emergency_active=True,
            emergency_type=str(type_raw),
            severity=str(severity_raw),
            eligible=False,
            reason=f"Severity level '{severity_raw}' is invalid.",
        )

    # Valid healthcare emergency
    return EmergencyEvent(
        location_id=loc_id,
        location_type=str(loc_type_raw),
        emergency_active=True,
        emergency_type=em_type,
        severity=sev,
        eligible=True,
        reason=f"Valid active {sev} emergency '{em_type}' at healthcare facility '{loc_type_raw}'.",
    )
