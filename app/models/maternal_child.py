from datetime import date, datetime

from sqlalchemy import String, Date, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MaternalChildRecord(Base):
    __tablename__ = "maternal_child_records"

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

    record_category: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    # -----------------------------------------------------
    # Maternal / pregnancy information
    # -----------------------------------------------------

    pregnancy_status: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    pregnancy_start_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    expected_delivery_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    anc_visit_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    anc_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    maternal_test_results: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    maternal_vaccination: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # -----------------------------------------------------
    # Child information
    # -----------------------------------------------------

    child_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    child_date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    child_vaccination: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    child_checkup_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    child_checkup_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    missed_follow_up: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    next_follow_up: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
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
        back_populates="maternal_child_records",
    )