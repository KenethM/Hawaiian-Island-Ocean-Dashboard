import time
from typing import Any

_store: dict[str, tuple[float, Any]] = {}

NOAA_TTL = 3600  # 1 hour — SST data is published once daily


def get(key: str, ttl: int = NOAA_TTL) -> Any | None:
    entry = _store.get(key)
    if entry and (time.time() - entry[0]) < ttl:
        return entry[1]
    return None


def set(key: str, value: Any) -> None:
    _store[key] = (time.time(), value)
