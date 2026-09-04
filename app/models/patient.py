from datetime import date, datetime

from sqlalchemy import String, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    patient_id: Mapped[str] = mapped_column(
        String(20),
        primary_key=True
    )

    user_id: Mapped[str] = mapped_column(
        String(3),
        ForeignKey("users.user_id"),
        nullable=False,
        index=True
    )

    full_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    age: Mapped[int] = mapped_column(
        nullable=False
    )

    gender: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    contact_number: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    location: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    emergency_contact: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    blood_group: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True
    )

    allergies: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    existing_conditions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    current_medications: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    risk_status: Mapped[str] = mapped_column(
        String(20),
        default="NORMAL",
        nullable=False
    )

    last_visit: Mapped[date | None] = mapped_column(
        Date,
        nullable=True
    )

    next_followup: Mapped[date | None] = mapped_column(
        Date,
        nullable=True
    )

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

    user = relationship(
        "User",
        back_populates="patient"
    )

    medical_records = relationship(
        "MedicalRecord",
        back_populates="patient",
        cascade="all, delete-orphan"
    )

    maternal_child_records = relationship(
        "MaternalChildRecord",
        back_populates="patient",
        cascade="all, delete-orphan"
    )

    chronic_disease_records = relationship(
        "ChronicDiseaseRecord",
        back_populates="patient",
        cascade="all, delete-orphan"
    )

    follow_ups = relationship(
        "FollowUp",
        back_populates="patient",
        cascade="all, delete-orphan"
    )