import json
from typing import Dict, Any, Set

# List of forbidden sensitive field names (case-insensitive checking)
FORBIDDEN_SENSITIVE_FIELDS: Set[str] = {
    "user_id",
    "username",
    "email",
    "password",
    "jwt",
    "token",
    "access_token",
    "authorization",
    "bearer",
    "medical_info",
    "medical_data",
    "face_data",
    "image_data",
    "pii",
    "appointment_details",
    "name",
    "full_name",
    "display_name",
    "phone",
    "ssn",
    "dob",
    "address",
    "credit_card",
    "secret",
}

ALLOWED_FIELDS: Set[str] = {"type", "token_ref"}
REQUIRED_TYPE: str = "queue_token"


class QRPayload:
    """
    Data model representing a non-sensitive QR Queue Token payload.
    Contains only 'type' ("queue_token") and 'token_ref' (opaque P5 token reference).
    """

    def __init__(self, token_ref: str, payload_type: str = REQUIRED_TYPE):
        if not isinstance(token_ref, str) or not token_ref.strip():
            raise ValueError("token_ref must be a non-empty string.")

        if payload_type != REQUIRED_TYPE:
            raise ValueError(f"Invalid payload type '{payload_type}'. Must be '{REQUIRED_TYPE}'.")

        self.type = payload_type
        self.token_ref = token_ref.strip()

    def to_dict(self) -> Dict[str, str]:
        return {
            "type": self.type,
            "token_ref": self.token_ref,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), separators=(",", ":"))

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "QRPayload":
        if not isinstance(data, dict):
            raise ValueError("Payload data must be a dictionary.")

        # Check for unexpected or sensitive fields
        data_keys_lower = {str(k).lower() for k in data.keys()}

        # Check forbidden sensitive fields
        sensitive_matches = data_keys_lower.intersection(FORBIDDEN_SENSITIVE_FIELDS)
        if sensitive_matches:
            raise ValueError(f"Payload contains sensitive/forbidden fields: {sorted(list(sensitive_matches))}")

        # Strict whitelist check: payload must ONLY contain allowed fields
        extra_keys = set(data.keys()) - ALLOWED_FIELDS
        if extra_keys:
            raise ValueError(f"Payload contains unexpected extra fields: {sorted(list(extra_keys))}")

        if "type" not in data:
            raise ValueError("Payload missing required 'type' field.")

        if "token_ref" not in data:
            raise ValueError("Payload missing required 'token_ref' field.")

        payload_type = data["type"]
        token_ref = data["token_ref"]

        if payload_type != REQUIRED_TYPE:
            raise ValueError(f"Invalid payload type '{payload_type}'. Expected '{REQUIRED_TYPE}'.")

        if not isinstance(token_ref, str) or not token_ref.strip():
            raise ValueError("token_ref must be a non-empty string.")

        return cls(token_ref=token_ref, payload_type=payload_type)

    @classmethod
    def from_json(cls, json_str: str) -> "QRPayload":
        if not isinstance(json_str, str) or not json_str.strip():
            raise ValueError("JSON input must be a non-empty string.")

        try:
            data = json.loads(json_str)
        except Exception as e:
            raise ValueError(f"Malformed JSON payload: {str(e)}")

        return cls.from_dict(data)

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, QRPayload):
            return False
        return self.type == other.type and self.token_ref == other.token_ref

    def __repr__(self) -> str:
        return f"QRPayload(type='{self.type}', token_ref='{self.token_ref}')"
