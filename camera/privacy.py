"""Privacy enforcement layer for camera sensing pipeline.

Guarantees that camera output contains strictly crowd-level aggregate information
and zero individual, biometric, or image payload data.
"""

from typing import Any, Dict, Set

PROHIBITED_KEYS: Set[str] = {
    "face", "face_id", "embedding", "embeddings", "name", "person_id",
    "identity", "identities", "image", "images", "frame", "frames",
    "tracking_id", "biometric", "biometrics", "bounding_box", "bbox",
    "crop", "features", "vector"
}

ALLOWED_KEYS: Set[str] = {
    "location_id", "camera_id", "people_count", "timestamp", "source"
}


class PrivacyLayer:
    """Enforces strict privacy controls on camera sensing outputs."""

    @staticmethod
    def sanitize_crowd_data(raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Strip all unapproved, sensitive, or personal data fields.

        Constructs a fresh dictionary containing only explicit, allowed crowd-level fields.

        Args:
            raw_data: Raw input dictionary potentially containing metadata or frame info.

        Returns:
            Dict[str, Any]: Sanitized dictionary containing ONLY allowed aggregate fields.

        Raises:
            TypeError: If raw_data is not a dictionary.
        """
        if not isinstance(raw_data, dict):
            raise TypeError("Input crowd data must be a dictionary.")

        sanitized = {
            "location_id": str(raw_data.get("location_id", "UNKNOWN")),
            "camera_id": str(raw_data.get("camera_id", "UNKNOWN")),
            "people_count": int(raw_data.get("people_count", 0)),
            "timestamp": str(raw_data.get("timestamp", "")),
            "source": str(raw_data.get("source", "simulation")),
        }

        return sanitized

    @classmethod
    def is_privacy_compliant(cls, data: Dict[str, Any]) -> bool:
        """Verify whether a dictionary contains any prohibited sensitive fields.

        Args:
            data: Data payload dictionary to evaluate.

        Returns:
            bool: True if compliant (no prohibited fields and only allowed keys present), False otherwise.
        """
        if not isinstance(data, dict):
            return False

        # Check for any prohibited key at top-level
        for key in data:
            if key.lower() in PROHIBITED_KEYS:
                return False
            if key not in ALLOWED_KEYS:
                return False

        return True
