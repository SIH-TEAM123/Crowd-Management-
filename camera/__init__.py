from camera.camera_config import CameraConfig, InputMode, PrivacyMode
from camera.privacy import PrivacyLayer

try:
    from camera.live_camera import LiveCamera
    from camera.video_demo import VideoDemo
    from camera.people_counter import PeopleCounter
    from camera.camera_processor import (
        CameraProcessor,
        camera_count_to_operational_state,
        generate_utc_timestamp,
    )
except ImportError:
    LiveCamera = None
    VideoDemo = None
    PeopleCounter = None
    CameraProcessor = None
    camera_count_to_operational_state = None
    generate_utc_timestamp = None

__all__ = [
    "LiveCamera",
    "VideoDemo",
    "CameraConfig",
    "InputMode",
    "PrivacyMode",
    "PeopleCounter",
    "PrivacyLayer",
    "CameraProcessor",
    "camera_count_to_operational_state",
    "generate_utc_timestamp"
]

