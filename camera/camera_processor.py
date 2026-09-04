"""Main software camera processor and Person 4 optimization adapter."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from camera.camera_config import CameraConfig, InputMode, PrivacyMode
from camera.people_counter import PeopleCounter
from camera.privacy import PrivacyLayer
from models.input_models import CurrentOperationalState


def generate_utc_timestamp() -> str:
    """Generate canonical UTC timezone-aware ISO-8601 timestamp string.

    Returns:
        str: ISO 8601 formatted UTC timestamp.
    """
    return datetime.now(timezone.utc).isoformat()


class CameraProcessor:
    """Software camera processor for crowd-level sensing."""

    def __init__(self, config: Optional[CameraConfig] = None):
        """Initialize software camera processor with optional configuration.

        Args:
            config: CameraConfig instance, or default if None.
        """
        self.config = config or CameraConfig()

    def process_simulation(
        self,
        location_id: Optional[str] = None,
        camera_id: Optional[str] = None,
        people_count: int = 0
    ) -> Dict[str, Any]:
        """Process crowd count via simulation mode.

        Args:
            location_id: Facility/location identifier override.
            camera_id: Camera identifier override.
            people_count: Raw simulated count of people.

        Returns:
            Dict[str, Any]: Sanitized crowd detection result.
        """
        loc_id = location_id or self.config.location_id
        cam_id = camera_id or self.config.camera_id

        validated_count = PeopleCounter.count_simulated(people_count)
        timestamp = generate_utc_timestamp()

        raw_result = {
            "location_id": loc_id,
            "camera_id": cam_id,
            "people_count": validated_count,
            "timestamp": timestamp,
            "source": "simulation"
        }

        return PrivacyLayer.sanitize_crowd_data(raw_result)

    def process_video(
        self,
        location_id: Optional[str] = None,
        camera_id: Optional[str] = None,
        detections: Optional[List[Any]] = None,
        people_count: Optional[int] = None
    ) -> Dict[str, Any]:
        """Process software video/prerecorded detection inputs.

        Operates purely on software detection lists or counts without OpenCV or hardware.

        Args:
            location_id: Location identifier override.
            camera_id: Camera identifier override.
            detections: Software detection list containing class labels.
            people_count: Pre-counted integer override.

        Returns:
            Dict[str, Any]: Sanitized crowd detection result.
        """
        loc_id = location_id or self.config.location_id
        cam_id = camera_id or self.config.camera_id

        if detections is not None:
            validated_count = PeopleCounter.count_detections(detections)
        elif people_count is not None:
            validated_count = PeopleCounter.count_simulated(people_count)
        else:
            validated_count = 0

        timestamp = generate_utc_timestamp()

        raw_result = {
            "location_id": loc_id,
            "camera_id": cam_id,
            "people_count": validated_count,
            "timestamp": timestamp,
            "source": "video"
        }

        return PrivacyLayer.sanitize_crowd_data(raw_result)

    def process_camera_reserved(
        self,
        location_id: Optional[str] = None,
        camera_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process CAMERA_RESERVED placeholder mode.

        Explicitly indicates hardware integration is not configured. Does NOT attempt hardware access.

        Args:
            location_id: Location identifier override.
            camera_id: Camera identifier override.

        Returns:
            Dict[str, Any]: Structured unconfigured hardware response.
        """
        loc_id = location_id or self.config.location_id
        cam_id = camera_id or self.config.camera_id
        timestamp = generate_utc_timestamp()

        return {
            "location_id": loc_id,
            "camera_id": cam_id,
            "status": "hardware integration not configured",
            "hardware_configured": False,
            "source": "camera_reserved",
            "timestamp": timestamp
        }

    def process(
        self,
        input_mode: Optional[InputMode] = None,
        location_id: Optional[str] = None,
        camera_id: Optional[str] = None,
        people_count: Optional[int] = None,
        detections: Optional[List[Any]] = None
    ) -> Dict[str, Any]:
        """General dispatch method based on configured or specified InputMode.

        Args:
            input_mode: Mode override (SIMULATION, VIDEO, CAMERA_RESERVED).
            location_id: Location ID override.
            camera_id: Camera ID override.
            people_count: Count override.
            detections: Detection list for VIDEO mode.

        Returns:
            Dict[str, Any]: Processed crowd result.
        """
        mode = input_mode or self.config.input_mode

        if mode == InputMode.SIMULATION:
            return self.process_simulation(
                location_id=location_id,
                camera_id=camera_id,
                people_count=people_count if people_count is not None else 0
            )
        elif mode == InputMode.VIDEO:
            return self.process_video(
                location_id=location_id,
                camera_id=camera_id,
                detections=detections,
                people_count=people_count
            )
        elif mode == InputMode.CAMERA_RESERVED:
            return self.process_camera_reserved(
                location_id=location_id,
                camera_id=camera_id
            )
        else:
            raise ValueError(f"Unsupported input mode: {mode}")


def camera_count_to_operational_state(
    crowd_result: Dict[str, Any],
    active_counters: int = 4,
    arrival_rate_per_min: float = 1.0,
    service_rate_per_counter_per_min: float = 0.5,
    average_wait_minutes: float = 5.0,
    utilization: float = 0.5,
    completed_service_times: Optional[List[float]] = None
) -> CurrentOperationalState:
    """Adapter mapping camera crowd result count to Person 4 CurrentOperationalState.

    Maps camera `people_count` to Person 4's operational state `queue_length`.

    Args:
        crowd_result: Sanitized result dictionary from camera processor.
        active_counters: Active service counters (default: 4).
        arrival_rate_per_min: Arrival rate per minute.
        service_rate_per_counter_per_min: Service rate per counter per minute.
        average_wait_minutes: Average wait time in minutes.
        utilization: Resource utilization ratio (0.0 to 1.0).
        completed_service_times: List of completed service times in minutes.

    Returns:
        CurrentOperationalState: Validated Person 4 Pydantic operational state model.
    """
    count = crowd_result.get("people_count", 0)

    return CurrentOperationalState(
        active_counters=active_counters,
        queue_length=count,
        arrival_rate_per_min=arrival_rate_per_min,
        service_rate_per_counter_per_min=service_rate_per_counter_per_min,
        average_wait_minutes=average_wait_minutes,
        utilization=utilization,
        completed_service_times=completed_service_times or []
    )
