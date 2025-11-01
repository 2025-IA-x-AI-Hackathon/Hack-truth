import json
import logging
import os
from typing import Optional, Any, Dict
from uuid import UUID, uuid4

import asyncpg
from asyncpg import Pool

logger = logging.getLogger(__name__)

_pool: Optional[Pool] = None


def _build_db_url() -> str:
    """Construct the PostgreSQL DSN from environment variables."""
    url = os.environ.get("DATABASE_URL")
    if url:
        return url

    host = os.environ.get("DATABASE_HOST")
    port = os.environ.get("DATABASE_PORT", "5432")
    user = os.environ.get("DATABASE_USER")
    password = os.environ.get("DATABASE_PASSWORD")
    name = os.environ.get("DATABASE_NAME")

    missing = [key for key, value in {
        "DATABASE_HOST": host,
        "DATABASE_USER": user,
        "DATABASE_PASSWORD": password,
        "DATABASE_NAME": name,
    }.items() if not value]

    if missing:
        raise RuntimeError(
            "Database configuration is incomplete; missing environment variables: "
            + ", ".join(missing)
        )

    return f"postgresql://{user}:{password}@{host}:{port}/{name}"


async def init_db_pool() -> None:
    """Initialize the global asyncpg pool and ensure the schema exists."""
    global _pool
    if _pool is not None:
        return

    dsn = _build_db_url()
    min_size = max(1, int(os.environ.get("DATABASE_POOL_MIN", "1")))
    max_size = max(min_size, int(os.environ.get("DATABASE_POOL_MAX", "5")))

    logger.debug(
        "Initializing PostgreSQL connection pool (min_size=%d, max_size=%d)",
        min_size,
        max_size,
    )

    _pool = await asyncpg.create_pool(dsn, min_size=min_size, max_size=max_size)

    async with _pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS verification_records (
                id UUID PRIMARY KEY,
                input_text TEXT NOT NULL,
                accuracy TEXT NOT NULL,
                accuracy_reason TEXT,
                reason TEXT NOT NULL,
                urls JSONB NOT NULL,
                raw_model_response TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        logger.debug("Ensured verification_records table exists")


async def close_db_pool() -> None:
    """Close the global connection pool."""
    global _pool
    if _pool is None:
        return
    await _pool.close()
    _pool = None
    logger.debug("Closed PostgreSQL connection pool")


async def insert_verification_record(
    *,
    input_text: str,
    accuracy: str,
    accuracy_reason: Optional[str],
    reason: str,
    urls: list[str],
    raw_response: Optional[str],
) -> UUID:
    """Persist a verification result and return its primary key."""
    if _pool is None:
        raise RuntimeError("Database pool has not been initialized. Call init_db_pool first.")

    record_id = uuid4()

    async with _pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO verification_records (
                id,
                input_text,
                accuracy,
                accuracy_reason,
                reason,
                urls,
                raw_model_response
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            record_id,
            input_text,
            accuracy,
            accuracy_reason,
            reason,
            json.dumps(urls),
            raw_response,
        )
        logger.debug("Persisted verification record with id=%s", record_id)

    return record_id


async def fetch_verification_record(record_id: UUID) -> Optional[Dict[str, Any]]:
    """Fetch a persisted verification result by its primary key."""
    if _pool is None:
        raise RuntimeError("Database pool has not been initialized. Call init_db_pool first.")

    async with _pool.acquire() as conn:
        record = await conn.fetchrow(
            """
            SELECT
                id,
                input_text,
                accuracy,
                accuracy_reason,
                reason,
                urls,
                raw_model_response,
                created_at
            FROM verification_records
            WHERE id = $1
            """,
            record_id,
        )

    if record is None:
        return None

    urls_value = record["urls"]
    if urls_value is None:
        urls_value = []
    if isinstance(urls_value, str):
        try:
            urls_value = json.loads(urls_value)
        except json.JSONDecodeError:
            logger.warning("Stored URLs for record %s are not valid JSON; defaulting to [].", record_id)
            urls_value = []
    if not isinstance(urls_value, list):
        logger.warning("Stored URLs for record %s are not a list; coerced to [].", record_id)
        urls_value = []

    return {
        "id": record["id"],
        "input_text": record["input_text"],
        "accuracy": record["accuracy"],
        "accuracy_reason": record["accuracy_reason"],
        "reason": record["reason"],
        "urls": urls_value,
        "raw_model_response": record["raw_model_response"],
        "created_at": record["created_at"],
    }
