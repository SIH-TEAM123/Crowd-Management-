"""
Temporary P5 -> P4 fairness integration bridge.
"""

import sys
from pathlib import Path
from typing import Any, Dict, List


# p4_fairness.py is located at:
#
# New project/
# ├── SIH P4/
# └── SIH P5/
#     └── app/
#         └── services/
#             └── p4_fairness.py
#
# Therefore:
# p4_fairness.py
#   -> services
#   -> app
#   -> SIH P5
#   -> New project
#
PROJECT_ROOT = Path(__file__).resolve().parents[3]
P4_ROOT = PROJECT_ROOT / "SIH P4"


if not P4_ROOT.exists():
    raise RuntimeError(
        f"P4 project not found.\n"
        f"Expected: {P4_ROOT}\n"
        f"Resolved from: {__file__}"
    )


INTEGRATION_FILE = P4_ROOT / "integration" / "crowd_pipeline.py"

if not INTEGRATION_FILE.exists():
    raise RuntimeError(
        f"P4 integration file not found.\n"
        f"Expected: {INTEGRATION_FILE}"
    )


# Add P4 root to Python's import path.
p4_root_string = str(P4_ROOT)

if p4_root_string not in sys.path:
    sys.path.insert(0, p4_root_string)


from integration.crowd_pipeline import run_crowd_pipeline


def run_fairness_for_queue(
    *,
    people_count: int,
    waiting_tokens: List[Any],
    active_counters: int = 1,
    facility_id: str = "HOSPITAL_001",
) -> Dict[str, Any]:
    """
    Run P4's crowd/fairness pipeline using P5 queue data.
    """

    vulnerable_users = 0

    for token in waiting_tokens:
        priority = getattr(token, "priority_type", "NORMAL")

        if hasattr(priority, "value"):
            priority = priority.value

        priority = str(priority).upper()

        if priority in {"VULNERABLE", "TIME_CRITICAL"}:
            vulnerable_users += 1

    return run_crowd_pipeline(
        people_count=max(0, int(people_count)),
        location_id=facility_id,
        facility_id=facility_id,
        location_type="hospital",
        institution_type="hospital",
        active_counters=max(1, int(active_counters)),
        vulnerable_users=vulnerable_users,
    )