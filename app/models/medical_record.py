from datetime import date, datetime

from sqlalchemy import String, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    record_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    patient_id: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("patients.patient_id"),
        nullable=False,
        index=True
    )

    record_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    visit_date: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )

    facility_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    department: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    diagnosis: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    prescription: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    test_results: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    referral: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    follow_up_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    patient = relationship(
        "Patient",
        back_populates="medical_records"
    )
    