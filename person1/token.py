from datetime import datetime, timedelta
from enum import Enum
import uuid


class TokenStatus(str, Enum):
    WAITING = "WAITING"
    SERVING = "SERVING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class PriorityType(str, Enum):
    NORMAL = "NORMAL"
    VULNERABLE = "VULNERABLE"
    TIME_CRITICAL = "TIME_CRITICAL"


class Token:
    def __init__(
        self,
        user_id=None,
        anonymous_user_id=None,
        display_name=None,
        priority_type=PriorityType.NORMAL,
        admin_configured_service_time_minutes=10,
        active_counters=1,
        expiry_minutes=None
    ):
        self.token_id = str(uuid.uuid4())

        self.user_id = user_id
        self.anonymous_user_id = anonymous_user_id
        self.display_name = display_name

        self.token_status = TokenStatus.WAITING
        self.queue_position = None

        self.priority_type = priority_type

        self.token_created_at = datetime.now().replace(microsecond=0)

        # Service has not started yet
        self.service_started_at = None

        # Service has not completed yet
        self.service_completed_at = None

        self.admin_configured_service_time_minutes = (
            admin_configured_service_time_minutes
        )

        self.active_counters = active_counters

        self.expiry_minutes = expiry_minutes

        self.token_expires_at = (
    self.token_created_at
    + timedelta(minutes=expiry_minutes)
)

        if expiry_minutes is not None:
            self.token_expires_at = (
                self.token_created_at
                + timedelta(minutes=expiry_minutes)
            )

    def start_service(self):
        self.token_status = TokenStatus.SERVING
        self.service_started_at = datetime.now().replace(microsecond=0)


    def complete_service(self):
        self.token_status = TokenStatus.COMPLETED
        self.service_completed_at = datetime.now().replace(microsecond=0)

    def cancel(self):
        self.token_status = TokenStatus.CANCELLED

    def expire(self):
        self.token_status = TokenStatus.EXPIRED

    def get_service_time_seconds(self):
        if (
            self.service_started_at is None
            or self.service_completed_at is None
        ):
            return None

        return round(
            (
                self.service_completed_at
                - self.service_started_at
            ).total_seconds(),
            2
        )