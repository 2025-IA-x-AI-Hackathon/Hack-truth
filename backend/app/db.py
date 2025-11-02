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

        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS video_analysis_records (
                id UUID PRIMARY KEY,
                video_url TEXT NOT NULL,
                video_id TEXT,
                video_path TEXT,
                fft_score DOUBLE PRECISION,
                motion_score DOUBLE PRECISION,
                ai_result TEXT,
                transcript TEXT,
                transcript_srt TEXT,
                duration DOUBLE PRECISION,
                fact_accuracy TEXT,
                fact_accuracy_reason TEXT,
                fact_reason TEXT,
                fact_urls JSONB,
                raw_fact_response TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        await conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_video_analysis_video_url
            ON video_analysis_records (video_url)
            """
        )
        await conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_video_analysis_video_id
            ON video_analysis_records (video_id)
            WHERE video_id IS NOT NULL
            """
        )
        logger.debug("Ensured video_analysis_records table exists")


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


async def fetch_video_analysis_record(
    video_url: str,
    video_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Fetch an existing video analysis result by canonical URL or video ID."""
    if _pool is None:
        raise RuntimeError("Database pool has not been initialized. Call init_db_pool first.")

    normalized_url = video_url.strip()

    async with _pool.acquire() as conn:
        record = await conn.fetchrow(
            """
            SELECT
                id,
                video_url,
                video_id,
                video_path,
                fft_score,
                motion_score,
                ai_result,
                transcript,
                transcript_srt,
                duration,
                fact_accuracy,
                fact_accuracy_reason,
                fact_reason,
                fact_urls,
                raw_fact_response,
                created_at,
                updated_at
            FROM video_analysis_records
            WHERE video_url = $1
            """,
            normalized_url,
        )

        if record is None and video_id:
            record = await conn.fetchrow(
                """
                SELECT
                    id,
                    video_url,
                    video_id,
                    video_path,
                    fft_score,
                    motion_score,
                    ai_result,
                    transcript,
                    transcript_srt,
                    duration,
                    fact_accuracy,
                    fact_accuracy_reason,
                    fact_reason,
                    fact_urls,
                    raw_fact_response,
                    created_at,
                    updated_at
                FROM video_analysis_records
                WHERE video_id = $1
                """,
                video_id,
            )

    if record is None:
        return None

    urls_value = record["fact_urls"]
    if urls_value is None:
        urls_value = []
    elif isinstance(urls_value, str):
        try:
            urls_value = json.loads(urls_value)
        except json.JSONDecodeError:
            logger.warning(
                "Stored fact URLs for video record %s are invalid JSON; defaulting to [].",
                record["id"],
            )
            urls_value = []

    if not isinstance(urls_value, list):
        urls_value = []

    return {
        "id": record["id"],
        "video_url": record["video_url"],
        "video_id": record["video_id"],
        "video_path": record["video_path"],
        "fft_score": record["fft_score"],
        "motion_score": record["motion_score"],
        "ai_result": record["ai_result"],
        "transcript": record["transcript"],
        "transcript_srt": record["transcript_srt"],
        "duration": record["duration"],
        "fact_accuracy": record["fact_accuracy"],
        "fact_accuracy_reason": record["fact_accuracy_reason"],
        "fact_reason": record["fact_reason"],
        "fact_urls": urls_value,
        "raw_fact_response": record["raw_fact_response"],
        "created_at": record["created_at"],
        "updated_at": record["updated_at"],
    }


async def upsert_video_analysis_record(
    *,
    video_url: str,
    video_id: Optional[str],
    video_path: str,
    fft_score: Optional[float],
    motion_score: Optional[float],
    ai_result: Optional[str],
    transcript: Optional[str],
    transcript_srt: Optional[str],
    duration: Optional[float],
    fact_accuracy: Optional[str],
    fact_accuracy_reason: Optional[str],
    fact_reason: Optional[str],
    fact_urls: Optional[list[str]],
    raw_fact_response: Optional[str],
) -> UUID:
    """Insert or update a video analysis record and return its identifier."""
    if _pool is None:
        raise RuntimeError("Database pool has not been initialized. Call init_db_pool first.")

    record_id = uuid4()
    urls_json = json.dumps(fact_urls or [])

    async with _pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO video_analysis_records (
                id,
                video_url,
                video_id,
                video_path,
                fft_score,
                motion_score,
                ai_result,
                transcript,
                transcript_srt,
                duration,
                fact_accuracy,
                fact_accuracy_reason,
                fact_reason,
                fact_urls,
                raw_fact_response
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, $14, $15
            )
            ON CONFLICT (video_url)
            DO UPDATE SET
                video_id = EXCLUDED.video_id,
                video_path = EXCLUDED.video_path,
                fft_score = EXCLUDED.fft_score,
                motion_score = EXCLUDED.motion_score,
                ai_result = EXCLUDED.ai_result,
                transcript = EXCLUDED.transcript,
                transcript_srt = EXCLUDED.transcript_srt,
                duration = EXCLUDED.duration,
                fact_accuracy = EXCLUDED.fact_accuracy,
                fact_accuracy_reason = EXCLUDED.fact_accuracy_reason,
                fact_reason = EXCLUDED.fact_reason,
                fact_urls = EXCLUDED.fact_urls,
                raw_fact_response = EXCLUDED.raw_fact_response,
                updated_at = NOW()
            RETURNING id
            """,
            record_id,
            video_url.strip(),
            video_id,
            video_path,
            fft_score,
            motion_score,
            ai_result,
            transcript,
            transcript_srt,
            duration,
            fact_accuracy,
            fact_accuracy_reason,
            fact_reason,
            urls_json,
            raw_fact_response,
        )

    return row["id"]
