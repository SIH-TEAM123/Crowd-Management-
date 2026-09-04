import asyncio
from sqlalchemy import select

from app.database import SessionLocal
import app.main  # Ensures all models and relationships are registered
from app.models.user import User


async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()

        print("\nExisting Users in Local Database:")
        print("---------------------------------")
        for user in users:
            print(f"ID: {user.user_id} | Email: {user.email} | Role: {user.role} | Verified: {user.is_verified}")
        print("---------------------------------\n")


if __name__ == "__main__":
    asyncio.run(main())