from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


# ============================================================
# ASYNC ENGINE & SESSION (Core VIZITOR async endpoints)
# ============================================================

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False
)

SessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with SessionLocal() as session:
        yield session


# ============================================================
# SYNC ENGINE & SESSION (Offline healthcare services & utils)
# ============================================================

raw_db_url = settings.DATABASE_URL or "sqlite:///./crowd_management.db"
sync_db_url = (
    raw_db_url.replace("sqlite+aiosqlite:", "sqlite:")
    .replace("postgresql+asyncpg:", "postgresql+psycopg2:")
)

try:
    sync_engine = create_engine(
        sync_db_url,
        connect_args={"check_same_thread": False} if "sqlite" in sync_db_url else {},
        echo=False
    )
except Exception as e:
    print(f"[Database] Notice creating sync engine with {sync_db_url}: {e}. Falling back to SQLite.")
    sync_engine = create_engine(
        "sqlite:///./crowd_management.db",
        connect_args={"check_same_thread": False},
        echo=False
    )

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False
)


def get_sync_db():
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()