"""Intelligent Healthcare Facility Recommendation and Routing Service using Real Database State."""

from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.facility import Facility, FacilityType
from app.models.specialist import AvailabilityStatus, Specialist
from app.models.diagnostic import DiagnosticTest
from app.models.medicine import FacilityInventory, Medicine
from app.models.referral import ReferralPriority
from app.schemas.routing import (
    FacilityRecommendation,
    FacilityRoutingRequest,
    FacilityRoutingResponse,
)
from app.services.facility_service import calculate_haversine_distance

# Documented tier weights for healthcare capabilities
FACILITY_TIER_WEIGHTS = {
    FacilityType.DISTRICT_HOSPITAL: 1.00,
    FacilityType.RURAL_HOSPITAL: 0.80,
    FacilityType.PHC: 0.60,
    FacilityType.SUB_CENTRE: 0.40,
}

# Mathematical scoring weights
WEIGHT_REQUIREMENT = 0.40
WEIGHT_DISTANCE = 0.35
WEIGHT_TIER = 0.15
WEIGHT_PRIORITY = 0.10


class RoutingService:
    """Intelligent facility routing engine evaluating availability, distance, and clinical tier."""

    @staticmethod
    def recommend_facilities(
        db: Session, request: FacilityRoutingRequest
    ) -> FacilityRoutingResponse:
        """Find and rank suitable healthcare facilities matching clinical and geographic requirements.

        Guarantees:
        1. Only active facilities are considered.
        2. Source facility is excluded if referring.
        3. Strict feasibility filtering: Every requested requirement (specialist, diagnostic, medicine)
           must be genuinely available in real DB state.
        4. Transparent mathematical scoring model.
        """
        # 1. Fetch active facilities
        query = db.query(Facility).filter(Facility.is_active.is_(True))

        if request.source_facility_id:
            query = query.filter(Facility.id != request.source_facility_id)

        if request.required_facility_type:
            query = query.filter(Facility.facility_type == request.required_facility_type)

        facilities = query.all()
        candidates: List[FacilityRecommendation] = []

        has_coords = request.latitude is not None and request.longitude is not None
        max_search_dist = request.max_distance_km or 50.0

        for fac in facilities:
            # Distance check
            dist_km: Optional[float] = None
            if has_coords:
                dist_km = round(
                    calculate_haversine_distance(
                        request.latitude, request.longitude, fac.latitude, fac.longitude
                    ),
                    2,
                )
                if request.max_distance_km is not None and dist_km > request.max_distance_km:
                    continue

            # Feasibility Check & Evidence Gathering
            matched_reqs: List[str] = []
            evidence: Dict[str, Any] = {}
            is_feasible = True

            # (A) Specialist feasibility
            if request.required_specialization:
                spec_matches = (
                    db.query(Specialist)
                    .filter(
                        Specialist.facility_id == fac.id,
                        Specialist.availability_status == AvailabilityStatus.AVAILABLE,
                        Specialist.specialization.ilike(f"%{request.required_specialization}%"),
                    )
                    .all()
                )
                if not spec_matches:
                    is_feasible = False
                else:
                    spec_names = [f"{s.name} ({s.specialization})" for s in spec_matches]
                    matched_reqs.append(
                        f"Specialist: {request.required_specialization} ({len(spec_matches)} available)"
                    )
                    evidence["specialists"] = spec_names

            if not is_feasible:
                continue

            # (B) Diagnostic test feasibility
            if request.required_diagnostic:
                diag_matches = (
                    db.query(DiagnosticTest)
                    .filter(
                        DiagnosticTest.facility_id == fac.id,
                        DiagnosticTest.is_available.is_(True),
                        DiagnosticTest.name.ilike(f"%{request.required_diagnostic}%"),
                    )
                    .all()
                )
                if not diag_matches:
                    is_feasible = False
                else:
                    diag_names = [d.name for d in diag_matches]
                    matched_reqs.append(
                        f"Diagnostic: {request.required_diagnostic} ({len(diag_matches)} available)"
                    )
                    evidence["diagnostics"] = diag_names

            if not is_feasible:
                continue

            # (C) Medicine feasibility
            if request.required_medicine:
                med_matches = (
                    db.query(FacilityInventory, Medicine)
                    .join(Medicine, FacilityInventory.medicine_id == Medicine.id)
                    .filter(
                        FacilityInventory.facility_id == fac.id,
                        FacilityInventory.quantity > 0,
                        or_(
                            Medicine.name.ilike(f"%{request.required_medicine}%"),
                            Medicine.generic_name.ilike(f"%{request.required_medicine}%"),
                            Medicine.id == request.required_medicine,
                        ),
                    )
                    .all()
                )
                if not med_matches:
                    is_feasible = False
                else:
                    med_details = [
                        f"{m.name} ({inv.quantity} {inv.unit} in stock)" for inv, m in med_matches
                    ]
                    matched_reqs.append(
                        f"Medicine: {request.required_medicine} ({med_matches[0][0].quantity} in stock)"
                    )
                    evidence["medicines"] = med_details

            if not is_feasible:
                continue

            # 2. Calculate Suitability Score
            score = RoutingService._calculate_score(
                fac=fac,
                distance_km=dist_km,
                max_search_dist=max_search_dist,
                priority=request.priority,
                has_coords=has_coords,
            )

            # 3. Construct Recommendation Explanation
            reason_parts: List[str] = []
            if dist_km is not None:
                reason_parts.append(f"{dist_km} km away")
            if matched_reqs:
                reason_parts.append(f"Confirmed availability: {', '.join(matched_reqs)}")
            tier_name = fac.facility_type.value if hasattr(fac.facility_type, "value") else str(fac.facility_type)
            reason_parts.append(f"Tier: {tier_name.replace('_', ' ').title()}")
            recommendation_reason = " | ".join(reason_parts)

            candidates.append(
                FacilityRecommendation(
                    facility_id=fac.id,
                    facility_name=fac.name,
                    facility_type=tier_name,
                    address=fac.address,
                    latitude=fac.latitude,
                    longitude=fac.longitude,
                    distance_km=dist_km,
                    suitability_score=score,
                    matched_requirements=matched_reqs,
                    availability_evidence=evidence,
                    recommendation_reason=recommendation_reason,
                )
            )

        # 4. Deterministic Multi-Criteria Sorting
        # Sort by suitability_score (DESC), distance_km (ASC), facility_id (ASC)
        candidates.sort(
            key=lambda c: (
                -c.suitability_score,
                c.distance_km if c.distance_km is not None else float("inf"),
                c.facility_id,
            )
        )

        ranked = candidates[: request.limit]

        return FacilityRoutingResponse(
            query_criteria=request.model_dump(exclude_none=True),
            total_matches=len(candidates),
            recommendations=ranked,
        )

    @staticmethod
    def _calculate_score(
        fac: Facility,
        distance_km: Optional[float],
        max_search_dist: float,
        priority: ReferralPriority,
        has_coords: bool,
    ) -> float:
        """Mathematical suitability scoring formula.

        Score = 100.0 * (
            w_req * S_req
            + w_dist * S_dist
            + w_tier * S_tier
            + w_prio * S_prio
        )
        """
        # S_req: Requirements fully satisfied = 1.0
        s_req = 1.0

        # S_dist: Normalized proximity score in [0.0, 1.0]
        if has_coords and distance_km is not None:
            norm_dist = min(1.0, distance_km / max(max_search_dist, 1.0))
            s_dist = max(0.0, 1.0 - norm_dist)
        else:
            s_dist = 0.5  # Neutral when location is omitted

        # S_tier: Healthcare facility tier weight
        s_tier = FACILITY_TIER_WEIGHTS.get(fac.facility_type, 0.50)

        # S_prio: Urgency priority alignment
        if priority == ReferralPriority.EMERGENCY:
            s_prio = 0.65 * s_dist + 0.35 * s_tier
        elif priority == ReferralPriority.URGENT:
            s_prio = 0.50 * s_dist + 0.50 * s_tier
        else:
            s_prio = 0.70

        total_normalized = (
            WEIGHT_REQUIREMENT * s_req
            + WEIGHT_DISTANCE * s_dist
            + WEIGHT_TIER * s_tier
            + WEIGHT_PRIORITY * s_prio
        )

        return round(min(100.0, max(0.0, total_normalized * 100.0)), 2)
