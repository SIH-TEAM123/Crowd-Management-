from datetime import date, datetime

from sqlalchemy import String, Date, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ChronicDiseaseRecord(Base):
    __tablename__ = "chronic_disease_records"

    record_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    patient_id: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("patients.patient_id"),
        nullable=False,
        index=True,
    )

    disease_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    diagnosis_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    diagnosis_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    medication: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    checkup_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    checkup_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    next_follow_up: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    missed_visit: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    reminder_status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING",
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    patient = relationship(
        "Patient",
        back_populates="chronic_disease_records",
    )