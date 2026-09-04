"""Camera sensing layer configuration models and constants."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class InputMode(str, Enum):
    SIMULATION = "SIMULATION"
    VIDEO = "VIDEO"
    LIVE_CAMERA = "LIVE_CAMERA"
    CAMERA_RESERVED = "CAMERA_RESERVED"

class PrivacyMode(str, Enum):
    """Privacy enforcement modes."""
    STRICT = "STRICT"
    ANONYMIZED = "ANONYMIZED"


class CameraConfig(BaseModel):
    """Camera sensing configuration model."""
    location_id: str = Field("HOSPITAL_001", min_length=1, description="Location identifier")
    camera_id: str = Field("CAMERA_01", min_length=1, description="Camera identifier")
    input_mode: InputMode = Field(InputMode.SIMULATION, description="Current camera input mode")
    processing_interval: float = Field(1.0, gt=0.0, description="Processing interval in seconds")
    privacy_mode: PrivacyMode = Field(PrivacyMode.STRICT, description="Privacy level enforced")
    min_people_count: int = Field(0, ge=0, description="Minimum valid count")
    max_people_count: int = Field(10000, ge=0, description="Maximum valid count limit")
