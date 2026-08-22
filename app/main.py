from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import engine, Base
from app.models.user import User
from app.routes.auth import router as auth_router
from app.routes.person4 import router as person4_router

@asynccontextmanager
async def lifespan(app: FastAPI):

    # Create database tables
    async with engine.begin() as connection:
        await connection.run_sync(
            Base.metadata.create_all
        )

    yield

    # Close database connection
    await engine.dispose()


app = FastAPI(
    title="Queue Management API",
    version="1.0.0",
    lifespan=lifespan
)


# Authentication routes
app.include_router(auth_router)
app.include_router(person4_router)


@app.get("/")
async def root():
    return {
        "message": "Queue Management API is running"
    }