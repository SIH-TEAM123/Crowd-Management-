"""Software Camera Sensing Module."""

from camera.camera_config import CameraConfig, InputMode, PrivacyMode
from camera.people_counter import PeopleCounter
from camera.privacy import PrivacyLayer
from camera.camera_processor import (
    CameraProcessor,
    camera_count_to_operational_state,
    generate_utc_timestamp
)

__all__ = [
    "CameraConfig",
    "InputMode",
    "PrivacyMode",
    "PeopleCounter",
    "PrivacyLayer",
    "CameraProcessor",
    "camera_count_to_operational_state",
    "generate_utc_timestamp"
]
