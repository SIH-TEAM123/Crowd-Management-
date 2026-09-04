from datetime import date, datetime

from sqlalchemy import String, Date, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FollowUp(Base):
    __tablename__ = "follow_ups"

    follow_up_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    patient_id: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("patients.patient_id"),
        nullable=False,
        index=True
    )

    follow_up_type: Mapped[str] = mapped_column(String(50), nullable=False)

    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)

    completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    missed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    alert_status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING",
        nullable=False
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    patient = relationship(
        "Patient",
        back_populates="follow_ups"
    )