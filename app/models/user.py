from datetime import datetime

from sqlalchemy import String, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(
        String(3),
        primary_key=True
    )

    full_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    role: Mapped[str] = mapped_column(
    String(20),
    default="user",
    nullable=False
)

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
)


    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )