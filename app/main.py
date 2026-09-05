from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base

# ============================================================
# MODELS
# ============================================================

from app.models.user import User
from app.models.appointment import Appointment
from app.models.token import Token
from app.models.hospital import Hospital
from app.models.article import Article
from app.models.arcade_score import ArcadeScore

# Healthcare - T50
from app.models.patient import Patient
from app.models.medical_record import MedicalRecord
from app.models.maternal_child import MaternalChildRecord
from app.models.chronic_disease import ChronicDiseaseRecord
from app.models.follow_up import FollowUp

# Healthcare - Offline Capabilities
from app.models.facility import Facility
from app.models.department import Department
from app.models.specialist import Specialist
from app.models.diagnostic import DiagnosticTest
from app.models.medicine import Medicine, FacilityInventory
from app.models.referral import Referral
from app.models.sms import SMSDeliveryRecord


# ============================================================
# ROUTES
# ============================================================

from app.routes.auth import router as auth_router
from app.routes.specialists import router as specialists_router
from app.routes.person4 import router as person4_router
from app.routes.appointments import router as appointments_router
from app.routes.hospitals import router as hospitals_router
from app.routes.articles import router as articles_router
from app.routes.arcade import router as arcade_router
from app.routes.facilities import router as facilities_router
from app.routes.departments import router as departments_router
from app.routes.diagnostics import router as diagnostics_router
from app.routes.medicines import router as medicines_router
from app.routes.referrals import router as referrals_router
from app.routes.operational_state import router as operational_state_router
from app.routes.routing import router as routing_router
from app.routes.sms import router as sms_router

# Healthcare - T50
from app.routes.patients import router as patients_router
from app.routes.medical_records import router as medical_records_router
from app.routes.triage import router as triage_router
from app.routes.maternal_child import router as maternal_child_router
from app.routes.chronic_disease import router as chronic_disease_router
from app.routes.follow_up import router as follow_up_router

# Offline capabilities routes imported above


# ============================================================
# SEEDING
# ============================================================

from app.seed_hospitals import seed_hospitals
from app.seed_articles import seed_articles
from app.seed_healthcare import seed_healthcare_network


# ============================================================
# APPLICATION LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    # Create database tables
    async with engine.begin() as connection:
        await connection.run_sync(
            Base.metadata.create_all
        )

        from sqlalchemy import text
        migrations = [
            "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS facility_id VARCHAR(64);",
            "ALTER TABLE tokens ADD COLUMN IF NOT EXISTS priority_type VARCHAR(30) DEFAULT 'NORMAL';",
            "ALTER TABLE tokens ADD COLUMN IF NOT EXISTS queue_position INTEGER;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';",
        ]
        for mig in migrations:
            try:
                await connection.execute(text(mig))
            except Exception as e:
                print(f"[Lifespan migration] Notice executing '{mig}': {e}")

    # Seed initial hospital data
    await seed_hospitals()

    # Seed initial article data
    await seed_articles()

    # Seed initial healthcare network data (Facilities, Specialists, Diagnostics, Medicines, Referrals)
    try:
        import asyncio
        await asyncio.to_thread(seed_healthcare_network)
    except Exception as e:
        print(f"[Lifespan] Healthcare network seeding notice: {e}")

    yield

    # Close database connection
    await engine.dispose()


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Queue Management API",
    version="1.0.0",
    lifespan=lifespan
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    err_tb = traceback.format_exc()
    print(f"[ERROR 500] {request.method} {request.url.path}: {exc}\n{err_tb}")
    origin = request.headers.get("origin") or "*"
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}", "type": type(exc).__name__},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "*",
        }
    )



# ============================================================
# EXISTING VIZITOR ROUTES
# ============================================================

# Authentication
app.include_router(auth_router)

# Crowd optimization
app.include_router(person4_router)

# Appointments / Queue
app.include_router(appointments_router)

# Hospitals
app.include_router(hospitals_router)

# Articles
app.include_router(articles_router)

# Arcade
app.include_router(arcade_router)

# ============================================================
# HEALTHCARE ROUTES - T50
# ============================================================

# Patient management
app.include_router(patients_router)

# Medical records
app.include_router(medical_records_router)

# Triage / risk assessment
app.include_router(triage_router)

# Maternal & child healthcare
app.include_router(maternal_child_router)

# Chronic disease management
app.include_router(chronic_disease_router)

# Follow-up management
app.include_router(follow_up_router)


# ============================================================
# HEALTHCARE ROUTES - OFFLINE CAPABILITIES
# ============================================================

app.include_router(operational_state_router)
app.include_router(routing_router)
app.include_router(facilities_router)
app.include_router(departments_router)
app.include_router(specialists_router)
app.include_router(diagnostics_router)
app.include_router(medicines_router)
app.include_router(referrals_router)
app.include_router(sms_router)


# ============================================================
# ROOT
# ============================================================

@app.get("/api")
async def root():
    return {
        "message": "Queue Management API is running"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Mount frontend static files so frontend is accessible directly on port 8000
import os
from fastapi.staticfiles import StaticFiles

if os.path.exists("frontend"):
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")