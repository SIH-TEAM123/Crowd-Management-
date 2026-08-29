import json
from typing import Tuple, Optional, Union, Dict, Any
from qr.qr_payload import QRPayload, FORBIDDEN_SENSITIVE_FIELDS, ALLOWED_FIELDS, REQUIRED_TYPE


class QRValidator:
    """
    Validator for QR Queue Token payloads.
    Ensures payloads conform to strict non-sensitive schema and reject malformed/PII payloads.
    """

    @staticmethod
    def is_sensitive_field_present(data: Dict[str, Any]) -> bool:
        """
        Check if any key in data matches forbidden sensitive/PII keywords.
        """
        if not isinstance(data, dict):
            return False
        keys_lower = {str(k).lower() for k in data.keys()}
        return len(keys_lower.intersection(FORBIDDEN_SENSITIVE_FIELDS)) > 0

    @classmethod
    def validate_payload(
        cls, payload_input: Union[str, Dict[str, Any]]
    ) -> Tuple[bool, Optional[str], Optional[QRPayload]]:
        """
        Validate a QR payload (JSON string or dict).
        Returns a tuple: (is_valid: bool, error_message: Optional[str], payload: Optional[QRPayload])
        """
        if payload_input is None:
            return False, "Payload input cannot be None.", None

        data: Dict[str, Any]

        if isinstance(payload_input, str):
            if not payload_input.strip():
                return False, "Payload string is empty.", None
            try:
                parsed = json.loads(payload_input)
                if not isinstance(parsed, dict):
                    return False, "Malformed payload: JSON root must be an object/dict.", None
                data = parsed
            except Exception as e:
                return False, f"Malformed JSON payload: {str(e)}", None
        elif isinstance(payload_input, dict):
            data = payload_input
        else:
            return False, f"Unsupported payload format. Expected str or dict, got {type(payload_input).__name__}.", None

        # 1. Reject if forbidden sensitive fields present
        if cls.is_sensitive_field_present(data):
            return False, "Payload rejected: contains sensitive or forbidden PII/credentials fields.", None

        # 2. Reject unexpected extra fields
        extra_keys = set(data.keys()) - ALLOWED_FIELDS
        if extra_keys:
            return False, f"Payload rejected: unexpected fields present {sorted(list(extra_keys))}.", None

        # 3. Check required 'type' field
        if "type" not in data:
            return False, "Payload rejected: missing required field 'type'.", None

        # 4. Check required 'token_ref' field
        if "token_ref" not in data:
            return False, "Payload rejected: missing required field 'token_ref'.", None

        # 5. Check 'type' value
        payload_type = data.get("type")
        if payload_type != REQUIRED_TYPE:
            return False, f"Payload rejected: invalid type '{payload_type}'. Must be '{REQUIRED_TYPE}'.", None

        # 6. Check 'token_ref' value
        token_ref = data.get("token_ref")
        if not isinstance(token_ref, str):
            return False, "Payload rejected: 'token_ref' must be a string.", None

        if not token_ref.strip():
            return False, "Payload rejected: 'token_ref' cannot be empty or whitespace.", None

        # Try building QRPayload
        try:
            payload_obj = QRPayload.from_dict(data)
            return True, None, payload_obj
        except Exception as e:
            return False, f"Payload rejected: {str(e)}", None
