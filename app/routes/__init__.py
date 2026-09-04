"""API routes package."""

from app.routes.facilities import router as facilities_router
from app.routes.specialists import router as specialists_router
from app.routes.diagnostics import router as diagnostics_router
from app.routes.medicines import router as medicines_router
from app.routes.referrals import router as referrals_router
from app.routes.routing import router as routing_router
from app.routes.operational_state import router as operational_state_router
from app.routes.appointments import router as appointments_router

__all__ = [
    "facilities_router",
    "specialists_router",
    "diagnostics_router",
    "medicines_router",
    "referrals_router",
    "routing_router",
    "operational_state_router",
    "appointments_router",
]
