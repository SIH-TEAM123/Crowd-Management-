"""SQLAlchemy models for Medicine catalog and Facility Inventory."""

from datetime import datetime, timezone
import uuid
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class Medicine(Base):
    """Pharmaceutical product / drug identity model."""
    __tablename__ = "medicines"

    id = Column(
        String(64),
        primary_key=True,
        index=True,
        default=lambda: f"MED_{uuid.uuid4().hex[:12]}",
    )
    name = Column(String(255), nullable=False, index=True)
    generic_name = Column(String(255), nullable=True, index=True)
    dosage_form = Column(String(100), nullable=True)  # e.g., Tablet, Capsule, Syrup, Injection
    strength = Column(String(100), nullable=True)     # e.g., 500mg, 250mg/5ml
    manufacturer = Column(String(255), nullable=True)
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

    inventories = relationship("FacilityInventory", back_populates="medicine", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Medicine(id='{self.id}', name='{self.name}', generic='{self.generic_name}')>"


class FacilityInventory(Base):
    """Stock inventory level for a medicine at a specific healthcare facility."""
    __tablename__ = "facility_inventories"
    __table_args__ = (
        UniqueConstraint("facility_id", "medicine_id", name="uq_facility_medicine"),
        CheckConstraint("quantity >= 0", name="chk_inventory_non_negative"),
    )

    id = Column(
        String(64),
        primary_key=True,
        index=True,
        default=lambda: f"INV_{uuid.uuid4().hex[:12]}",
    )
    facility_id = Column(
        String(64),
        ForeignKey("facilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    medicine_id = Column(
        String(64),
        ForeignKey("medicines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantity = Column(Integer, default=0, nullable=False)
    unit = Column(String(50), default="units", nullable=False)
    batch_number = Column(String(100), nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
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

    facility = relationship("Facility", back_populates="inventory")
    medicine = relationship("Medicine", back_populates="inventories")

    @property
    def is_available(self) -> bool:
        """Derive availability directly from non-negative quantity."""
        return self.quantity > 0

    @property
    def availability_status(self) -> str:
        """Derive standardized availability status."""
        return "AVAILABLE" if self.quantity > 0 else "UNAVAILABLE"

    def __repr__(self) -> str:
        return (
            f"<FacilityInventory(facility='{self.facility_id}', medicine='{self.medicine_id}', "
            f"qty={self.quantity}, status='{self.availability_status}')>"
        )
