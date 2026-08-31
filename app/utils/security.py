from datetime import datetime, timedelta, timezone
import jwt
from pwdlib import PasswordHash
from app.config import settings


# -----------------------------
# Password Hashing
# -----------------------------

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    return password_hash.verify(
        plain_password,
        hashed_password
    )


# -----------------------------
# JWT
# -----------------------------

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60


def create_access_token(user_id: str) -> str:

    expire = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    payload = {
        "sub": user_id,
        "exp": expire
    }

    token = jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=ALGORITHM
    )

    return token


def decode_access_token(token: str):

    try:

        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[ALGORITHM]
        )

        return payload

    except jwt.InvalidTokenError:

        return None