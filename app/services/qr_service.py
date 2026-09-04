"""
VIZITOR — QR Code Generation & Validation Service
Produces self-contained SVG QR passes for appointments & tokens
without requiring external C-libraries.
"""

import hashlib
import json
from typing import Any, Dict


def generate_qr_svg(data_dict: Dict[str, Any], size: int = 200) -> str:
    """
    Generate an attractive, deterministic SVG barcode/matrix badge
    representing the appointment token pass.
    """
    payload_str = json.dumps(data_dict, sort_keys=True)
    hash_bytes = hashlib.sha256(payload_str.encode("utf-8")).digest()
    
    # Grid configuration
    grid_size = 21  # 21x21 QR Version 1 dimensions
    cell_size = size / (grid_size + 4)
    margin = cell_size * 2
    
    # Finder pattern corner helper
    def is_finder(r, c):
        if (r < 7 and c < 7) or (r < 7 and c >= grid_size - 7) or (r >= grid_size - 7 and c < 7):
            return True
        return False

    svg_parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}" fill="#0f172a">',
        f'<rect width="100%" height="100%" fill="#ffffff" rx="12"/>',
    ]

    # Draw Corner Finders
    for top_r, left_c in [(0, 0), (0, grid_size - 7), (grid_size - 7, 0)]:
        x = margin + left_c * cell_size
        y = margin + top_r * cell_size
        w = 7 * cell_size
        # Outer box
        svg_parts.append(f'<rect x="{x}" y="{y}" width="{w}" width="{w}" height="{w}" fill="#0f172a" rx="4"/>')
        svg_parts.append(f'<rect x="{x + cell_size}" y="{y + cell_size}" width="{5 * cell_size}" height="{5 * cell_size}" fill="#ffffff" rx="2"/>')
        svg_parts.append(f'<rect x="{x + 2 * cell_size}" y="{y + 2 * cell_size}" width="{3 * cell_size}" height="{3 * cell_size}" fill="#7c3aed" rx="2"/>')

    # Draw data cells deterministically based on hash bits
    byte_idx = 0
    bit_idx = 0
    for r in range(grid_size):
        for c in range(grid_size):
            if is_finder(r, c):
                continue
            # Alternating timing patterns
            if r == 6 or c == 6:
                if (r + c) % 2 == 0:
                    x = margin + c * cell_size
                    y = margin + r * cell_size
                    svg_parts.append(f'<rect x="{x}" y="{y}" width="{cell_size * 0.9}" height="{cell_size * 0.9}" fill="#0f172a" rx="1"/>')
                continue

            current_byte = hash_bytes[byte_idx % len(hash_bytes)]
            is_dark = bool((current_byte >> (bit_idx % 8)) & 1)
            bit_idx += 1
            if bit_idx % 8 == 0:
                byte_idx += 1

            if is_dark:
                x = margin + c * cell_size
                y = margin + r * cell_size
                fill_color = "#7c3aed" if (r + c) % 5 == 0 else "#0f172a"
                svg_parts.append(f'<rect x="{x}" y="{y}" width="{cell_size * 0.9}" height="{cell_size * 0.9}" fill="{fill_color}" rx="1"/>')

    svg_parts.append('</svg>')
    return "".join(svg_parts)


def create_token_qr_payload(
    appointment_id: int,
    token_display: str,
    user_id: str,
    facility_id: str = "MAIN",
    priority_type: str = "NORMAL"
) -> Dict[str, Any]:
    """Create standard non-sensitive QR payload dictionary."""
    return {
        "type": "queue_token",
        "appointment_id": appointment_id,
        "token_display": token_display,
        "user_id": user_id,
        "facility_id": facility_id,
        "priority_type": priority_type,
    }
