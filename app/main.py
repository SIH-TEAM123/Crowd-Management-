"""FastAPI Backend Application Entrypoint for Healthcare Facility Network."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes.facilities import router as facilities_router
from app.routes.departments import router as departments_router
from app.routes.specialists import router as specialists_router
from app.routes.diagnostics import router as diagnostics_router
from app.routes.medicines import router as medicines_router
from app.routes.referrals import router as referrals_router
from app.routes.routing import router as routing_router
from app.routes.operational_state import router as operational_state_router
from app.routes.appointments import router as appointments_router
from app.routes.sms import router as sms_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and shutdown routines."""
    init_db()
    yield


app = FastAPI(
    title="SIH Healthcare Network & Crowd Management API",
    description="Backend API for Healthcare Facility Discovery, Queue Sensing, and Operational Optimization",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers (Mount routing_router and operational_state_router before facilities_router so static subpaths take precedence)
app.include_router(routing_router)
app.include_router(operational_state_router)
app.include_router(appointments_router)
app.include_router(sms_router)
app.include_router(departments_router)
app.include_router(facilities_router)
app.include_router(specialists_router)
app.include_router(diagnostics_router)
app.include_router(medicines_router)
app.include_router(referrals_router)


@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "sih-backend", "version": "1.0.0"}
