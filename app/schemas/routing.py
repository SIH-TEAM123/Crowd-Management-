"""Pydantic schemas for Intelligent Healthcare Facility Routing and Recommendations."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.models.facility import FacilityType
from app.models.referral import ReferralPriority


class FacilityRoutingRequest(BaseModel):
    """Input parameters for intelligent facility recommendation and routing."""
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="Patient/origin latitude in decimal degrees")
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="Patient/origin longitude in decimal degrees")
    required_specialization: Optional[str] = Field(None, max_length=100, description="Clinical specialty needed (e.g. Cardiology, Orthopedics)")
    required_diagnostic: Optional[str] = Field(None, max_length=255, description="Diagnostic service/test required (e.g. MRI Brain, CBC)")
    required_medicine: Optional[str] = Field(None, max_length=255, description="Pharmaceutical product or generic name required")
    required_facility_type: Optional[FacilityType] = Field(None, description="Specific healthcare tier requested")
    priority: ReferralPriority = Field(ReferralPriority.ROUTINE, description="Clinical urgency level")
    source_facility_id: Optional[str] = Field(None, max_length=64, description="Originating facility ID (excluded from recommendations if referring)")
    max_distance_km: Optional[float] = Field(None, gt=0.0, description="Maximum search radius in kilometers")
    limit: int = Field(10, ge=1, le=100, description="Maximum number of recommendations to return")

    @field_validator("required_specialization", "required_diagnostic", "required_medicine", "source_facility_id")
    @classmethod
    def strip_and_clean_strings(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_clean = v.strip()
            return v_clean if v_clean else None
        return None

    @model_validator(mode="after")
    def validate_meaningful_request(self) -> "FacilityRoutingRequest":
        """Ensure at least one meaningful requirement or location is provided."""
        has_location = self.latitude is not None and self.longitude is not None
        has_coord_mismatch = (self.latitude is not None and self.longitude is None) or (
            self.latitude is None and self.longitude is not None
        )
        if has_coord_mismatch:
            raise ValueError("Both latitude and longitude must be provided together.")

        has_requirement = (
            has_location
            or self.required_specialization is not None
            or self.required_diagnostic is not None
            or self.required_medicine is not None
            or self.required_facility_type is not None
        )
        if not has_requirement:
            raise ValueError(
                "Routing request must specify at least one search criterion: "
                "origin coordinates, required specialization, diagnostic test, medicine, or facility type."
            )
        return self


class FacilityRecommendation(BaseModel):
    """Detailed recommendation record for a suitable healthcare facility."""
    facility_id: str
    facility_name: str
    facility_type: str
    address: str
    latitude: float
    longitude: float
    distance_km: Optional[float] = None
    suitability_score: float = Field(..., ge=0.0, le=100.0, description="Calculated suitability score (0-100)")
    matched_requirements: List[str] = Field(default_factory=list, description="Summary of confirmed matching services")
    availability_evidence: Dict[str, Any] = Field(default_factory=dict, description="Concrete availability records found in DB")
    recommendation_reason: str = Field(..., description="Transparent clinical and operational explanation for ranking")

    model_config = ConfigDict(from_attributes=True)


class FacilityRoutingResponse(BaseModel):
    """Response payload containing ranked facility recommendations."""
    query_criteria: Dict[str, Any]
    total_matches: int
    recommendations: List[FacilityRecommendation]
