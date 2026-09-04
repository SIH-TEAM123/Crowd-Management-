from contextlib import asynccontextmanager
from app.routes.medical_records import router as medical_records_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.models.patient import Patient
from app.database import engine, Base
from app.routes.triage import router as triage_router
from app.routes.patients import router as patients_router
from app.models.user import User
from app.models.appointment import Appointment
from app.models.token import Token
from app.models.hospital import Hospital
from app.routes.auth import router as auth_router
from app.routes.person4 import router as person4_router
from app.routes.appointments import router as appointments_router
from app.routes.hospitals import router as hospitals_router
from app.seed_hospitals import seed_hospitals
from app.models.medical_record import MedicalRecord
from app.models.maternal_child import MaternalChildRecord
from app.routes.maternal_child import router as maternal_child_router
from app.models.chronic_disease import ChronicDiseaseRecord
from app.routes.chronic_disease import router as chronic_disease_router
from app.models.follow_up import FollowUp
from app.routes.follow_up import router as follow_up_router

@asynccontextmanager
async def lifespan(app: FastAPI):

    # Create database tables
    async with engine.begin() as connection:
        await connection.run_sync(
            Base.metadata.create_all
        )

    await seed_hospitals()

    yield

    # Close database connection
    await engine.dispose()


app = FastAPI(
    title="Queue Management API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication routes
app.include_router(auth_router)
app.include_router(person4_router)
app.include_router(appointments_router)
app.include_router(hospitals_router)
app.include_router(patients_router)
app.include_router(medical_records_router)
app.include_router(triage_router)
app.include_router(maternal_child_router)
app.include_router(chronic_disease_router)
app.include_router(follow_up_router)

@app.get("/")
async def root():
    return {
        "message": "Queue Management API is running"
    }