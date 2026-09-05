"""Authentication and security dependencies for operator/admin authorization."""

import os
from typing import Optional
from fastapi import Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.utils.security import decode_access_token
from app.database import SyncSessionLocal
from app.models.user import User

# Configurable valid admin and operator keys/tokens
ADMIN_API_KEYS = set(
    os.getenv("ADMIN_API_KEYS", "admin-secret-key,operator-secret-key,sih-admin-2026").split(",")
)

security_bearer = HTTPBearer(auto_error=False)


def require_admin_or_operator(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    auth_credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
) -> str:
    """Validate that the request has valid operator or admin credentials.

    Supports:
    1. 'X-API-Key' custom header
    2. 'Authorization: Bearer <token>' header (API key or JWT token)

    Raises:
        HTTPException: 401 Unauthorized if missing or invalid credentials.
    """
    token = None

    if x_api_key:
        token = x_api_key.strip()
    elif auth_credentials and auth_credentials.credentials:
        token = auth_credentials.credentials.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required for this operation.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Direct API key match
    if token in ADMIN_API_KEYS:
        return token

    # 2. JWT token validation
    payload = decode_access_token(token)
    if payload and "sub" in payload:
        # Check user in sync DB
        user_id = payload.get("sub")
        try:
            with SyncSessionLocal() as db:
                user = db.query(User).filter(User.user_id == user_id).first()
                if user and (user.role in ("admin", "operator") or user.is_verified):
                    return token
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Valid operator/admin credentials required for this operation.",
        headers={"WWW-Authenticate": "Bearer"},
    )
