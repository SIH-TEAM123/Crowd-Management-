from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import String, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


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


class Token(Base):
    __tablename__ = "tokens"

    token_id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True
    )

    token_number: Mapped[str] = mapped_column(
    String(10),
    unique=True,
    nullable=False
)

    user_id: Mapped[Optional[str]] = mapped_column(
        String(3),
        nullable=True
    )

    anonymous_user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True
    )

    display_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )

    token_status: Mapped[TokenStatus] = mapped_column(
        String(20),
        default=TokenStatus.WAITING,
        nullable=False
    )

    queue_position: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )

    priority_type: Mapped[PriorityType] = mapped_column(
        String(20),
        default=PriorityType.NORMAL,
        nullable=False
    )

    token_created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    service_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True
    )

    service_completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True
    )

    admin_configured_service_time_minutes: Mapped[int] = mapped_column(
        Integer,
        default=10,
        nullable=False
    )

    active_counters: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False
    )

    expiry_minutes: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )

    token_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True
    )