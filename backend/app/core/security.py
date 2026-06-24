import os
import logging
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt

log = logging.getLogger(__name__)

_RAW_SECRET = os.getenv("JWT_SECRET", "")
_DEFAULT_SENTINEL = "change-me-in-production-please"

if not _RAW_SECRET:
    log.critical(
        "JWT_SECRET env var is not set — using an insecure default. "
        "Set JWT_SECRET to a long random string before deploying."
    )
    _RAW_SECRET = _DEFAULT_SENTINEL

SECRET_KEY = _RAW_SECRET
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None
