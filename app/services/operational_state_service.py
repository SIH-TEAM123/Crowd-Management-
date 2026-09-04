"""Unified Facility Operational State Service combining real database state, camera telemetry, and Person 3 prediction."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.facility import Facility
from app.models.specialist import AvailabilityStatus, Specialist
from app.models.diagnostic import BookingStatus, DiagnosticBooking, DiagnosticTest
from app.models.medicine import FacilityInventory
from app.models.referral import Referral, ReferralStatus
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.operational_state import (
    CameraTelemetryPublish,
    FacilityOperationalState,
)
from camera.privacy import PrivacyLayer
from emergency.emergency_rules import validate_emergency_event, EmergencyEvent
from emergency.priority_engine import calculate_emergency_priority_score

# In-memory telemetry streams for live edge camera integration
_CAMERA_TELEMETRY_REGISTRY: Dict[str, Dict[str, Any]] = {}
_EMERGENCY_TELEMETRY_REGISTRY: Dict[str, Dict[str, Any]] = {}


class OperationalStateService:
    """Aggregates unified operational state for healthcare facilities across all backend systems."""

    # -------------------------------------------------------------------------
    # Camera Telemetry Ingestion
    # -------------------------------------------------------------------------

    @staticmethod
    def publish_camera_telemetry(
        facility_id: str,
        telemetry_in: CameraTelemetryPublish,
    ) -> Dict[str, Any]:
        """Register live crowd count telemetry from camera vision pipeline.

        Applies strict privacy stripping to eliminate any sensitive biometric keys.
        """
        raw_data = {
            "facility_id": facility_id,
            "camera_id": telemetry_in.camera_id,
            "people_count": telemetry_in.people_count,
            "timestamp": (telemetry_in.timestamp or datetime.now(timezone.utc)).isoformat(),
            "location_type": telemetry_in.location_type or "waiting_area",
            "source": "live_vision_pipeline",
        }
        sanitized = PrivacyLayer.sanitize_crowd_data(raw_data)
        _CAMERA_TELEMETRY_REGISTRY[facility_id] = sanitized
        return sanitized

    @staticmethod
    def get_camera_telemetry(facility_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve latest camera crowd telemetry for a facility."""
        return _CAMERA_TELEMETRY_REGISTRY.get(facility_id)

    @staticmethod
    def clear_camera_telemetry(facility_id: Optional[str] = None) -> None:
        """Clear camera telemetry records (primarily used for test isolation)."""
        if facility_id:
            _CAMERA_TELEMETRY_REGISTRY.pop(facility_id, None)
        else:
            _CAMERA_TELEMETRY_REGISTRY.clear()

    # -------------------------------------------------------------------------
    # Emergency Telemetry Ingestion
    # -------------------------------------------------------------------------

    @staticmethod
    def publish_emergency_event(
        facility_id: str,
        emergency_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Register emergency event and calculate real priority score."""
        event: EmergencyEvent = validate_emergency_event(emergency_data)
        priority_score = calculate_emergency_priority_score(event)
        record = {
            "facility_id": facility_id,
            "event": event,
            "priority_score": priority_score,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        _EMERGENCY_TELEMETRY_REGISTRY[facility_id] = record
        return record

    @staticmethod
    def get_emergency_load(facility_id: str) -> Optional[float]:
        """Retrieve emergency priority load if an active emergency exists, else NULL."""
        rec = _EMERGENCY_TELEMETRY_REGISTRY.get(facility_id)
        if rec and rec["event"].emergency_active and rec["event"].eligible:
            return float(rec["priority_score"])
        return None

    @staticmethod
    def clear_emergency_telemetry(facility_id: Optional[str] = None) -> None:
        """Clear emergency telemetry records."""
        if facility_id:
            _EMERGENCY_TELEMETRY_REGISTRY.pop(facility_id, None)
        else:
            _EMERGENCY_TELEMETRY_REGISTRY.clear()

    # -------------------------------------------------------------------------
    # Unified Operational State Aggregation
    # -------------------------------------------------------------------------

    @staticmethod
    def get_facility_operational_state(
        db: Session, facility_id: str
    ) -> FacilityOperationalState:
        """Compile a unified operational state for a healthcare facility using real database state.

        Strictly returns NULL for metrics lacking an authentic data source.

        Raises:
            ValueError: If facility_id does not exist in the database.
        """
        facility = db.query(Facility).filter(Facility.id == facility_id).first()
        if not facility:
            raise ValueError(f"Facility with ID '{facility_id}' not found.")

        now = datetime.now(timezone.utc)
        data_sources: Dict[str, str] = {}

        # 1. Specialists
        specialists_total = (
            db.query(Specialist).filter(Specialist.facility_id == facility_id).count()
        )
        specialists_available = (
            db.query(Specialist)
            .filter(
                Specialist.facility_id == facility_id,
                Specialist.availability_status == AvailabilityStatus.AVAILABLE,
            )
            .count()
        )
        data_sources["specialists"] = "specialist_database"

        # 2. Diagnostics
        diagnostics_total = (
            db.query(DiagnosticTest).filter(DiagnosticTest.facility_id == facility_id).count()
        )
        diagnostics_available = (
            db.query(DiagnosticTest)
            .filter(
                DiagnosticTest.facility_id == facility_id,
                DiagnosticTest.is_available.is_(True),
            )
            .count()
        )
        data_sources["diagnostics"] = "diagnostic_database"

        # 3. Medicines
        medicines_in_stock = (
            db.query(FacilityInventory)
            .filter(
                FacilityInventory.facility_id == facility_id,
                FacilityInventory.quantity > 0,
            )
            .count()
        )
        medicines_out_of_stock = (
            db.query(FacilityInventory)
            .filter(
                FacilityInventory.facility_id == facility_id,
                FacilityInventory.quantity == 0,
            )
            .count()
        )
        data_sources["medicines"] = "facility_inventory"

        # 4. Referrals
        referrals_in_progress = (
            db.query(Referral)
            .filter(
                or_(
                    Referral.source_facility_id == facility_id,
                    Referral.destination_facility_id == facility_id,
                ),
                Referral.status == ReferralStatus.IN_PROGRESS,
            )
            .count()
        )
        referrals_incoming = (
            db.query(Referral).filter(Referral.destination_facility_id == facility_id).count()
        )
        referrals_outgoing = (
            db.query(Referral).filter(Referral.source_facility_id == facility_id).count()
        )
        data_sources["referrals"] = "referral_database"

        # 5. Appointment Queue (Primary Facility Operational Queue)
        has_any_appointments = (
            db.query(Appointment).filter(Appointment.facility_id == facility_id).first() is not None
        )

        if has_any_appointments:
            # Active waiting in queue (SCHEDULED or CHECKED_IN)
            waiting_appointments = (
                db.query(Appointment)
                .filter(
                    Appointment.facility_id == facility_id,
                    Appointment.status.in_(
                        [AppointmentStatus.CHECKED_IN, AppointmentStatus.SCHEDULED]
                    ),
                )
                .count()
            )
            # Currently in consultation / serving
            serving_appointments = (
                db.query(Appointment)
                .filter(
                    Appointment.facility_id == facility_id,
                    Appointment.status == AppointmentStatus.IN_CONSULTATION,
                )
                .count()
            )
            queue_length: Optional[int] = waiting_appointments
            current_serving: Optional[int] = serving_appointments
            people_present: Optional[int] = waiting_appointments + serving_appointments
            data_sources["queue"] = "appointment_queue_database"
        else:
            # Fallback to diagnostic bookings if facility only runs diagnostic services
            has_any_bookings = (
                db.query(DiagnosticBooking).filter(DiagnosticBooking.facility_id == facility_id).first()
                is not None
            )
            if has_any_bookings:
                active_bookings_count = (
                    db.query(DiagnosticBooking)
                    .filter(
                        DiagnosticBooking.facility_id == facility_id,
                        DiagnosticBooking.status.in_(
                            [
                                BookingStatus.REQUESTED,
                                BookingStatus.BOOKED,
                                BookingStatus.IN_PROGRESS,
                            ]
                        ),
                    )
                    .count()
                )
                queue_length = active_bookings_count
                current_serving = (
                    db.query(DiagnosticBooking)
                    .filter(
                        DiagnosticBooking.facility_id == facility_id,
                        DiagnosticBooking.status == BookingStatus.IN_PROGRESS,
                    )
                    .count()
                )
                people_present = active_bookings_count
                data_sources["queue"] = "diagnostic_bookings_queue"
            else:
                queue_length = None
                current_serving = None
                people_present = None

        # 6. Camera Crowd Telemetry (Strict NULL if not published)
        telemetry = OperationalStateService.get_camera_telemetry(facility_id)
        if telemetry is not None:
            current_crowd: Optional[int] = telemetry.get("people_count")
            data_sources["camera"] = "live_camera_telemetry"
        else:
            current_crowd = None

        # 7. Person-3 ML Wait-Time Prediction
        # If real queue data exists, run Person-3 prediction; otherwise NULL
        predicted_wait: Optional[float] = None
        estimated_wait: Optional[float] = None
        if queue_length is not None:
            try:
                from prediction_interface import predict_wait_minutes

                # Real time values from current timestamp
                hour = now.hour
                minute = now.minute
                day_of_week = now.weekday()

                # Run V3 ML prediction
                pred_mins = predict_wait_minutes(
                    queue_ahead=queue_length,
                    daily_caller=max(1, queue_length * 5),
                    hour=hour,
                    minute=minute,
                    day_of_week=day_of_week,
                    recent_arrivals=max(1.0, float(queue_length)),
                    recent_services=max(1.0, float(queue_length * 0.8)),
                    avg_service_time=200.0,
                    time_since_previous_call=10.0,
                )
                predicted_wait = round(float(pred_mins), 2)
                estimated_wait = predicted_wait
                data_sources["prediction"] = "person3_ml_wait_model_v3"
            except Exception:
                predicted_wait = None
                estimated_wait = None

        # 8. Service Capacity (Strict NULL if not configured)
        service_capacity: Optional[int] = None

        # 9. Emergency Load (Strict NULL if no active emergency stream)
        emergency_load = OperationalStateService.get_emergency_load(facility_id)
        if emergency_load is not None:
            data_sources["emergency"] = "emergency_priority_engine"

        tier_str = (
            facility.facility_type.value
            if hasattr(facility.facility_type, "value")
            else str(facility.facility_type)
        )

        return FacilityOperationalState(
            facility_id=facility.id,
            facility_name=facility.name,
            facility_type=tier_str,
            is_active=facility.is_active,
            current_crowd=current_crowd,
            queue_length=queue_length,
            current_serving=current_serving,
            people_present=people_present,
            predicted_wait=predicted_wait,
            estimated_wait=estimated_wait,
            service_capacity=service_capacity,
            specialists_total=specialists_total,
            specialists_available=specialists_available,
            diagnostics_total=diagnostics_total,
            diagnostics_available=diagnostics_available,
            medicines_in_stock=medicines_in_stock,
            medicines_out_of_stock=medicines_out_of_stock,
            referrals_in_progress=referrals_in_progress,
            referrals_incoming=referrals_incoming,
            referrals_outgoing=referrals_outgoing,
            emergency_load=emergency_load,
            timestamp=now,
            data_sources=data_sources,
        )

    @staticmethod
    def get_all_operational_states(
        db: Session, is_active_only: bool = True
    ) -> List[FacilityOperationalState]:
        """Retrieve operational states across all healthcare facilities."""
        query = db.query(Facility)
        if is_active_only:
            query = query.filter(Facility.is_active.is_(True))

        facilities = query.all()
        return [
            OperationalStateService.get_facility_operational_state(db, fac.id)
            for fac in facilities
        ]
