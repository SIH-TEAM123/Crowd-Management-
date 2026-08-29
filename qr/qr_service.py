"""
QR Service module for P4.

IMPORTANT ARCHITECTURAL RULE:
QRService does NOT create queue tokens. P5 is the sole owner of token generation
and queue numbering via its POST /tokens endpoint.
QRService only accepts already-created P5 token references, creates safe QR payloads,
validates QR payloads, processes QR scans (with duplicate scan protection), and provides
a read-only status retrieval hook to P5.
"""

from typing import Dict, Any, Union, Optional, Tuple
from qr.qr_payload import QRPayload
from qr.qr_validator import QRValidator


class P5TokenStatusClient:
    """
    Read-only integration client hook for querying existing token status from P5.

    NOTE: Token creation is explicitly outside this client and outside P4's QR module.
    P5 owns POST /tokens.
    """

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip("/")

    def get_token_status_endpoint(self, token_ref: str) -> str:
        """
        Returns the target endpoint for querying token status in P5.
        """
        return f"{self.base_url}/tokens/{token_ref}"

    def fetch_token_info(self, token_ref: str, auth_header: Optional[str] = None) -> Dict[str, Any]:
        """
        Integration contract hook for fetching existing token status from P5.
        In a live environment, this performs HTTP GET to P5.
        """
        if not token_ref or not token_ref.strip():
            raise ValueError("token_ref must be provided.")

        # Integration contract placeholder for P5 GET request
        return {
            "token_ref": token_ref,
            "status": "WAITING",
            "endpoint": self.get_token_status_endpoint(token_ref),
            "note": "Integration hook for P5 token status retrieval"
        }


class QRService:
    """
    Service layer for QR payload generation, validation, scan processing,
    and deduplication.
    """

    def __init__(self, status_client: Optional[P5TokenStatusClient] = None):
        self.status_client = status_client or P5TokenStatusClient()
        # In-memory registry for scanned token references to ensure scan deduplication
        self._processed_scans: Dict[str, Dict[str, Any]] = {}

    def create_qr_payload(self, token_ref: str) -> QRPayload:
        """
        Create a safe QR payload from an ALREADY-EXISTING P5 token reference.

        NOTE: Does NOT create tokens in P5 or P4.
        """
        return QRPayload(token_ref=token_ref)

    def validate_qr_payload(
        self, payload_input: Union[str, Dict[str, Any]]
    ) -> Tuple[bool, Optional[str], Optional[QRPayload]]:
        """
        Validate a QR payload input.
        """
        return QRValidator.validate_payload(payload_input)

    def process_qr_scan(
        self, qr_input: Union[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Process a scanned QR payload.

        Checks payload validity and prevents duplicate processing/token creation
        for repeated scans. Returns scan result containing status and token reference.
        """
        is_valid, error_msg, payload = self.validate_qr_payload(qr_input)
        if not is_valid or payload is None:
            return {
                "success": False,
                "error": error_msg or "Invalid payload",
                "scanned_payload": None,
                "is_duplicate_scan": False,
            }

        token_ref = payload.token_ref
        is_duplicate = token_ref in self._processed_scans

        if is_duplicate:
            # Duplicate scan detected: return existing scan reference without re-processing or creating tokens
            existing_record = self._processed_scans[token_ref]
            existing_record["scan_count"] += 1
            return {
                "success": True,
                "message": "Duplicate scan detected; returning existing token scan reference.",
                "token_ref": token_ref,
                "payload": payload.to_dict(),
                "is_duplicate_scan": True,
                "scan_count": existing_record["scan_count"],
            }

        # First time scan record
        scan_record = {
            "token_ref": token_ref,
            "payload": payload.to_dict(),
            "scan_count": 1,
        }
        self._processed_scans[token_ref] = scan_record

        return {
            "success": True,
            "message": "QR scan processed successfully.",
            "token_ref": token_ref,
            "payload": payload.to_dict(),
            "is_duplicate_scan": False,
            "scan_count": 1,
        }

    def clear_scan_history(self) -> None:
        """
        Clear scan history cache.
        """
        self._processed_scans.clear()

    @staticmethod
    def generate_qr_image_data(payload: QRPayload) -> bytes:
        """
        Integration hook for rendering a QR code image from a QRPayload.

        Requires a QR generation library (such as 'qrcode' or 'segno').
        Currently, no QR image library is installed in the environment.
        """
        raise NotImplementedError(
            "QR image rendering library (e.g. 'qrcode' or 'segno') is not installed in the environment. "
            "To enable QR image generation, install 'qrcode' or 'segno' and implement PNG/SVG byte rendering here."
        )
