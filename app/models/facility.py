"""SQLAlchemy Facility model for healthcare network discovery and management."""

from datetime import datetime, timezone
import enum
import uuid
from sqlalchemy import Boolean, Column, DateTime, Enum as SQLEnum, Float, String, Text
from sqlalchemy.orm import relationship
from app.database import Base


class FacilityType(str, enum.Enum):
    """Classification of healthcare facilities in the SIH network."""
    SUB_CENTRE = "SUB_CENTRE"
    PHC = "PHC"
    RURAL_HOSPITAL = "RURAL_HOSPITAL"
    DISTRICT_HOSPITAL = "DISTRICT_HOSPITAL"


class Facility(Base):
    """Healthcare facility entity in the network."""
    __tablename__ = "facilities"

    id = Column(String(64), primary_key=True, index=True, default=lambda: f"FAC_{uuid.uuid4().hex[:12]}")
    name = Column(String(255), nullable=False, index=True)
    facility_type = Column(SQLEnum(FacilityType), nullable=False, index=True)
    address = Column(Text, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    contact_phone = Column(String(50), nullable=True)
    contact_email = Column(String(100), nullable=True)
    contact_info = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    specialists = relationship("Specialist", back_populates="facility", cascade="all, delete-orphan")
    diagnostics = relationship("DiagnosticTest", back_populates="facility", cascade="all, delete-orphan")
    inventory = relationship("FacilityInventory", back_populates="facility", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="facility", cascade="all, delete-orphan")
    departments = relationship("Department", back_populates="facility", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Facility(id='{self.id}', name='{self.name}', type='{self.facility_type}')>"
