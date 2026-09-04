"""Healthcare Emergency Sensing and Priority Fairness Module."""

from emergency.emergency_rules import (
    EmergencyEvent,
    validate_emergency_event,
    SUPPORTED_HEALTHCARE_LOCATIONS,
    SUPPORTED_EMERGENCY_TYPES,
    SEVERITY_LEVELS,
)
from emergency.priority_engine import (
    calculate_emergency_priority_score,
    evaluate_emergency_fairness,
)
from emergency.emergency_modules import (
    combine_camera_and_emergency,
    emergency_to_optimization_input,
)

__all__ = [
    "EmergencyEvent",
    "validate_emergency_event",
    "calculate_emergency_priority_score",
    "evaluate_emergency_fairness",
    "combine_camera_and_emergency",
    "emergency_to_optimization_input",
    "SUPPORTED_HEALTHCARE_LOCATIONS",
    "SUPPORTED_EMERGENCY_TYPES",
    "SEVERITY_LEVELS",
]
