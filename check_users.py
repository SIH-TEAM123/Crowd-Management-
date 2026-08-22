import asyncio
from sqlalchemy import select

from app.database import SessionLocal
from app.models.user import User


async def main():
    db = SessionLocal()

    result = await db.execute(select(User))
    users = result.scalars().all()

    print("Users:")
    for user in users:
        print(user.user_id, user.email, user.role)

    await db.close()


asyncio.run(main())