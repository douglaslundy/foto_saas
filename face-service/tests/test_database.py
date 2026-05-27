# face-service/tests/test_database.py
import pytest
import numpy as np
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone, timedelta


def make_mock_pool():
    pool = AsyncMock()
    return pool


@pytest.mark.asyncio
async def test_insert_face_embeddings_returns_count():
    """insert_face_embeddings insere N linhas e retorna o count."""
    from app.database import insert_face_embeddings
    from app.models import DetectedFace

    pool = make_mock_pool()
    pool.executemany = AsyncMock(return_value=None)

    faces = [
        DetectedFace(
            embedding=np.zeros(512, dtype=np.float32),
            bounding_box={"x1": 0.0, "y1": 0.0, "x2": 50.0, "y2": 50.0},
            det_score=0.95,
        ),
        DetectedFace(
            embedding=np.ones(512, dtype=np.float32),
            bounding_box={"x1": 60.0, "y1": 0.0, "x2": 110.0, "y2": 50.0},
            det_score=0.88,
        ),
    ]
    expires = datetime.now(timezone.utc) + timedelta(days=90)
    count = await insert_face_embeddings(pool, "photo-1", "event-1", "tenant-1", faces, expires)

    assert count == 2
    pool.executemany.assert_called_once()
    call_args = pool.executemany.call_args[0]
    assert len(call_args[1]) == 2  # 2 rows


@pytest.mark.asyncio
async def test_insert_face_embeddings_returns_zero_for_empty():
    """insert_face_embeddings retorna 0 e não acessa o DB quando lista de faces está vazia."""
    from app.database import insert_face_embeddings

    pool = make_mock_pool()
    count = await insert_face_embeddings(pool, "photo-1", "event-1", "tenant-1", [], None)

    assert count == 0
    pool.executemany.assert_not_called()


@pytest.mark.asyncio
async def test_search_faces_returns_matches_above_threshold():
    """search_faces retorna apenas matches com score >= threshold."""
    from app.database import search_faces

    pool = make_mock_pool()
    pool.fetch = AsyncMock(return_value=[
        {"photo_id": "photo-a", "face_index": 0, "score": 0.85},
        {"photo_id": "photo-b", "face_index": 1, "score": 0.55},  # abaixo do threshold
    ])

    query_embedding = np.zeros(512, dtype=np.float32)
    results = await search_faces(pool, "event-1", "tenant-1", query_embedding, threshold=0.6)

    assert len(results) == 1
    assert results[0]["photo_id"] == "photo-a"
    assert results[0]["score"] == 0.85


@pytest.mark.asyncio
async def test_delete_faces_by_photo_returns_deleted_count():
    """delete_faces_by_photo retorna o número de linhas deletadas."""
    from app.database import delete_faces_by_photo

    pool = make_mock_pool()
    pool.execute = AsyncMock(return_value="DELETE 3")

    deleted = await delete_faces_by_photo(pool, "photo-uuid-1")
    assert deleted == 3


@pytest.mark.asyncio
async def test_delete_faces_by_event_returns_deleted_count():
    """delete_faces_by_event deleta por event_id + tenant_id."""
    from app.database import delete_faces_by_event

    pool = make_mock_pool()
    pool.execute = AsyncMock(return_value="DELETE 10")

    deleted = await delete_faces_by_event(pool, "event-1", "tenant-1")
    assert deleted == 10


@pytest.mark.asyncio
async def test_delete_expired_embeddings_returns_count():
    """delete_expired_embeddings remove embeddings com expires_at no passado."""
    from app.database import delete_expired_embeddings

    pool = make_mock_pool()
    pool.execute = AsyncMock(return_value="DELETE 7")

    deleted = await delete_expired_embeddings(pool)
    assert deleted == 7
