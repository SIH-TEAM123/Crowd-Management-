from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
)
from app.config import settings
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True
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