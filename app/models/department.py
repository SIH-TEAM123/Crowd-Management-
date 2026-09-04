"""SQLAlchemy model for Healthcare Departments within facilities."""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship
from app.database import Base


class Department(Base):
    """Healthcare facility clinical or outpatient department."""
    __tablename__ = "departments"

    id = Column(
        String(64),
        primary_key=True,
        index=True,
        default=lambda: f"DEPT_{uuid.uuid4().hex[:12]}",
    )
    facility_id = Column(
        String(64),
        ForeignKey("facilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(100), nullable=False, index=True)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
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

    facility = relationship("Facility", back_populates="departments")

    def __repr__(self) -> str:
        return f"<Department(id='{self.id}', name='{self.name}', facility_id='{self.facility_id}')>"
