import json
import pytest
from qr.qr_payload import QRPayload
from qr.qr_validator import QRValidator
from qr.qr_service import QRService, P5TokenStatusClient


def test_1_valid_qr_payload():
    payload = QRPayload(token_ref="c1f7a0e2-8b9a-4c12-9e5f-123456789abc")
    assert payload.type == "queue_token"
    assert payload.token_ref == "c1f7a0e2-8b9a-4c12-9e5f-123456789abc"
    assert payload.to_dict() == {
        "type": "queue_token",
        "token_ref": "c1f7a0e2-8b9a-4c12-9e5f-123456789abc"
    }


def test_2_missing_token_ref():
    invalid_dict = {"type": "queue_token"}
    is_valid, err, payload = QRValidator.validate_payload(invalid_dict)
    assert not is_valid
    assert "missing required field 'token_ref'" in err
    assert payload is None


def test_3_invalid_type():
    invalid_dict = {"type": "appointment_token", "token_ref": "ref-123"}
    is_valid, err, payload = QRValidator.validate_payload(invalid_dict)
    assert not is_valid
    assert "invalid type" in err.lower()
    assert payload is None


def test_4_empty_token_ref():
    invalid_dict = {"type": "queue_token", "token_ref": "   "}
    is_valid, err, payload = QRValidator.validate_payload(invalid_dict)
    assert not is_valid
    assert "cannot be empty" in err.lower()
    assert payload is None


def test_5_sensitive_fields_rejected():
    sensitive_payloads = [
        {"type": "queue_token", "token_ref": "ref-123", "user_id": "usr_99"},
        {"type": "queue_token", "token_ref": "ref-123", "email": "user@example.com"},
        {"type": "queue_token", "token_ref": "ref-123", "jwt": "eyJhbGciOi..."},
        {"type": "queue_token", "token_ref": "ref-123", "password": "secret_pass"},
        {"type": "queue_token", "token_ref": "ref-123", "medical_info": "asthma"},
        {"type": "queue_token", "token_ref": "ref-123", "name": "John Doe"},
    ]
    for sp in sensitive_payloads:
        is_valid, err, payload = QRValidator.validate_payload(sp)
        assert not is_valid
        assert "sensitive" in err.lower() or "unexpected" in err.lower()
        assert payload is None


def test_6_malformed_payload_rejected():
    malformed_inputs = [
        "{ invalid json }",
        "\"just a string\"",
        12345,
        {"type": "queue_token", "token_ref": 12345},  # non-string token_ref
        {"type": "queue_token", "token_ref": "ref-1", "extra": "val"},
    ]
    for inp in malformed_inputs:
        is_valid, err, payload = QRValidator.validate_payload(inp)
        assert not is_valid
        assert err is not None
        assert payload is None


def test_7_deterministic_validation():
    valid_json = json.dumps({"type": "queue_token", "token_ref": "ref-deterministic-100"})
    for _ in range(10):
        is_valid, err, payload = QRValidator.validate_payload(valid_json)
        assert is_valid
        assert err is None
        assert payload.token_ref == "ref-deterministic-100"
        assert payload.type == "queue_token"


def test_8_existing_p5_token_reference_accepted():
    p5_token_ref = "A001"  # Or UUID from P5 POST /tokens response
    service = QRService()
    payload = service.create_qr_payload(token_ref=p5_token_ref)
    assert payload.token_ref == "A001"

    is_valid, err, validated_payload = service.validate_qr_payload(payload.to_dict())
    assert is_valid
    assert validated_payload.token_ref == "A001"


def test_9_no_fake_token_generation():
    service = QRService()
    # Confirm QRService does NOT have a token creation method
    assert not hasattr(service, "create_token")
    assert not hasattr(service, "generate_token")

    # Confirm P5TokenStatusClient is read-only status client
    client = P5TokenStatusClient()
    assert not hasattr(client, "create_token")
    assert hasattr(client, "fetch_token_info")


def test_10_no_pii_in_qr_payload():
    service = QRService()
    payload = service.create_qr_payload(token_ref="p5-token-uuid-12345")
    d = payload.to_dict()
    assert set(d.keys()) == {"type", "token_ref"}
    for key in ["user_id", "email", "name", "full_name", "phone", "medical_data", "face_data"]:
        assert key not in d


def test_11_no_jwt_password_in_qr():
    service = QRService()
    payload = service.create_qr_payload(token_ref="p5-token-uuid-12345")
    json_str = payload.to_json()
    assert "jwt" not in json_str.lower()
    assert "bearer" not in json_str.lower()
    assert "password" not in json_str.lower()
    assert "secret" not in json_str.lower()


def test_12_duplicate_qr_scans_do_not_create_duplicate_tokens():
    service = QRService()
    qr_dict = {"type": "queue_token", "token_ref": "p5-token-uuid-unique-555"}

    # First scan
    result1 = service.process_qr_scan(qr_dict)
    assert result1["success"]
    assert not result1["is_duplicate_scan"]
    assert result1["scan_count"] == 1

    # Second scan with exact same QR
    result2 = service.process_qr_scan(qr_dict)
    assert result2["success"]
    assert result2["is_duplicate_scan"]
    assert result2["scan_count"] == 2
    assert result2["token_ref"] == "p5-token-uuid-unique-555"
