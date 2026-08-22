from fastapi import Depends, HTTPException

from app.models.user import User
from app.utils.auth import get_current_user


def require_role(required_role: str):

    async def role_checker(
        user: User = Depends(get_current_user)
    ) -> User:

        if user.role != required_role:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions"
            )

        return user


    return role_checker


async def require_admin(
    user: User = Depends(require_role("admin"))
) -> User:
    return user


async def require_operator(
    user: User = Depends(require_role("operator"))
) -> User:
    return user