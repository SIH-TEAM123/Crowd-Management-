from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.models.user import User
from app.models.appointment import Appointment
from app.models.token import Token
from app.models.hospital import Hospital
from app.routes.auth import router as auth_router
from app.routes.person4 import router as person4_router
from app.routes.appointments import router as appointments_router
from app.routes.hospitals import router as hospitals_router
from app.seed_hospitals import seed_hospitals

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


@app.get("/")
async def root():
    return {
        "message": "Queue Management API is running"
    }