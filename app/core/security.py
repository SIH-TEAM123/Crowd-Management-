"""Authentication and security dependencies for operator/admin authorization."""

import os
from typing import Optional
from fastapi import Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

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

    Supports either:
    1. 'X-API-Key' custom header
    2. 'Authorization: Bearer <token>' header

    Raises:
        HTTPException: 401 Unauthorized if missing or invalid credentials.
    """
    token = None

    if x_api_key:
        token = x_api_key.strip()
    elif auth_credentials and auth_credentials.credentials:
        token = auth_credentials.credentials.strip()

    if not token or token not in ADMIN_API_KEYS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid operator/admin credentials required for this operation.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token
