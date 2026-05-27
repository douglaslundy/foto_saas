from __future__ import annotations
import json
import numpy as np
from datetime import datetime
from app.models import DetectedFace

_pool = None  # type: ignore[assignment]


async def get_pool():
    """Returns the asyncpg connection pool (lazy-initialized)."""
    global _pool
    if _pool is None:
        import asyncpg
        from pgvector.asyncpg import register_vector
        from app.config import settings
        _pool = await asyncpg.create_pool(
            settings.DATABASE_URL,
            init=register_vector,
            min_size=2,
            max_size=10,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def insert_face_embeddings(
    pool,
    photo_id: str,
    event_id: str,
    tenant_id: str,
    faces: "list[DetectedFace]",
    expires_at: "datetime | None",
) -> int:
    if not faces:
        return 0
    rows = [
        (
            photo_id,
            event_id,
            tenant_id,
            i,
            face.embedding,
            json.dumps(face.bounding_box),
            face.det_score,
            expires_at,
        )
        for i, face in enumerate(faces)
    ]
    await pool.executemany(
        """INSERT INTO face_embeddings
           (photo_id, event_id, tenant_id, face_index, embedding, bounding_box, det_score, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
           ON CONFLICT DO NOTHING""",
        rows,
    )
    return len(rows)


async def search_faces(
    pool,
    event_id: str,
    tenant_id: str,
    query_embedding: "np.ndarray",
    threshold: float = 0.6,
    limit: int = 100,
) -> "list[dict]":
    rows = await pool.fetch(
        """SELECT photo_id::text, face_index,
                  1 - (embedding <=> $1) AS score
           FROM face_embeddings
           WHERE event_id = $2::uuid
             AND tenant_id = $3::uuid
             AND (expires_at IS NULL OR expires_at > NOW())
           ORDER BY embedding <=> $1
           LIMIT $4""",
        query_embedding,
        event_id,
        tenant_id,
        limit,
    )
    return [
        {
            "photo_id": row["photo_id"],
            "face_index": row["face_index"],
            "score": float(row["score"]),
        }
        for row in rows
        if float(row["score"]) >= threshold
    ]


async def delete_faces_by_photo(pool, photo_id: str) -> int:
    result = await pool.execute(
        "DELETE FROM face_embeddings WHERE photo_id = $1::uuid", photo_id
    )
    return int(result.split()[-1])


async def delete_faces_by_event(pool, event_id: str, tenant_id: str) -> int:
    result = await pool.execute(
        "DELETE FROM face_embeddings WHERE event_id = $1::uuid AND tenant_id = $2::uuid",
        event_id,
        tenant_id,
    )
    return int(result.split()[-1])


async def delete_faces_by_tenant(pool, tenant_id: str) -> int:
    result = await pool.execute(
        "DELETE FROM face_embeddings WHERE tenant_id = $1::uuid", tenant_id
    )
    return int(result.split()[-1])


async def delete_expired_embeddings(pool) -> int:
    result = await pool.execute(
        "DELETE FROM face_embeddings WHERE expires_at IS NOT NULL AND expires_at <= NOW()"
    )
    return int(result.split()[-1])
