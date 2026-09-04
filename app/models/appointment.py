from datetime import datetime, date, time

from sqlalchemy import String, Date, Time, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Appointment(Base):
    __tablename__ = "appointments"

    appointment_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    user_id: Mapped[str] = mapped_column(
        String(3),
        ForeignKey("users.user_id"),
        nullable=False,
        index=True
    )

    facility_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("facilities.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    token_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        unique=True
    )

    purpose: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    appointment_date: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )

    appointment_time: Mapped[time] = mapped_column(
        Time,
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="PENDING",
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    facility = relationship(
        "Facility",
        back_populates="appointments"
    )

    sms_records = relationship(
        "SMSDeliveryRecord",
        back_populates="appointment",
        cascade="all, delete-orphan"
    )