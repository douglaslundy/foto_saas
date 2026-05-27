# face-service/tests/test_search.py
import pytest
import numpy as np
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from app.models import DetectedFace


def make_selfie_bytes() -> bytes:
    """Bytes mínimos de JPEG para simular uma selfie."""
    return b"\xff\xd8\xff\xe0" + b"\x00" * 100


def make_face_with_embedding(det_score=0.95):
    return DetectedFace(
        embedding=np.ones(512, dtype=np.float32) / np.sqrt(512),
        bounding_box={"x1": 0.0, "y1": 0.0, "x2": 100.0, "y2": 100.0},
        det_score=det_score,
    )


@pytest.mark.asyncio
async def test_search_returns_matches():
    """POST /search retorna lista de matches com photo_id e score."""
    from app.main import app

    mock_matches = [
        {"photo_id": "photo-a", "face_index": 0, "score": 0.87},
        {"photo_id": "photo-b", "face_index": 1, "score": 0.75},
    ]

    with patch("app.routes.search.detect_faces", return_value=[make_face_with_embedding()]), \
         patch("app.routes.search.get_pool", new=AsyncMock(return_value=AsyncMock())), \
         patch("app.routes.search.search_faces", new=AsyncMock(return_value=mock_matches)):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/search",
                data={"event_id": "event-1", "tenant_id": "tenant-1"},
                files={"selfie": ("selfie.jpg", make_selfie_bytes(), "image/jpeg")},
            )

    assert response.status_code == 200
    data = response.json()
    assert len(data["matches"]) == 2
    assert data["matches"][0]["photo_id"] == "photo-a"
    assert data["matches"][0]["score"] == 0.87


@pytest.mark.asyncio
async def test_search_returns_422_when_no_face_in_selfie():
    """POST /search retorna 422 quando nenhuma face é detectada na selfie."""
    from app.main import app

    with patch("app.routes.search.detect_faces", return_value=[]):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/search",
                data={"event_id": "event-1", "tenant_id": "tenant-1"},
                files={"selfie": ("selfie.jpg", make_selfie_bytes(), "image/jpeg")},
            )

    assert response.status_code == 422
    assert "rosto" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_search_uses_most_prominent_face_when_multiple():
    """POST /search usa a face com maior det_score quando há múltiplas na selfie."""
    from app.main import app

    face_low = DetectedFace(
        embedding=np.zeros(512, dtype=np.float32),
        bounding_box={"x1": 0.0, "y1": 0.0, "x2": 100.0, "y2": 100.0},
        det_score=0.6,
    )
    face_high = make_face_with_embedding(det_score=0.97)

    captured = {}

    async def mock_search_faces(pool, event_id, tenant_id, embedding, threshold, limit):
        captured["embedding"] = embedding
        return []

    with patch("app.routes.search.detect_faces", return_value=[face_low, face_high]), \
         patch("app.routes.search.get_pool", new=AsyncMock(return_value=AsyncMock())), \
         patch("app.routes.search.search_faces", side_effect=mock_search_faces):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/search",
                data={"event_id": "event-1", "tenant_id": "tenant-1"},
                files={"selfie": ("selfie.jpg", make_selfie_bytes(), "image/jpeg")},
            )

    # A embedding passada para search_faces deve ser a do face_high (det_score 0.97)
    assert np.array_equal(captured["embedding"], face_high.embedding)
