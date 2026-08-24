from datetime import datetime

from sqlalchemy import String, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Token(Base):
    __tablename__ = "tokens"

    token_id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True
    )

    user_id: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        index=True
    )

    queue_position: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
    )

    priority_type: Mapped[str] = mapped_column(
        String(30),
        default="NORMAL",
        nullable=False
    )

    token_status: Mapped[str] = mapped_column(
        String(20),
        default="WAITING",
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
