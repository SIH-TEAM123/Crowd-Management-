from datetime import datetime

from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ArcadeScore(Base):
    __tablename__ = "arcade_scores"

    score_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    user_id: Mapped[str] = mapped_column(
        String(3),
        ForeignKey("users.user_id"),
        nullable=False,
        index=True
    )

    token_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        index=True
    )

    game_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )

    score: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    queue_session: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )