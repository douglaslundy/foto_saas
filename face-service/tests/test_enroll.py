# face-service/tests/test_enroll.py
import pytest
import numpy as np
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from app.models import DetectedFace


def make_face():
    return DetectedFace(
        embedding=np.zeros(512, dtype=np.float32),
        bounding_box={"x1": 0.0, "y1": 0.0, "x2": 50.0, "y2": 50.0},
        det_score=0.95,
    )


@pytest.mark.asyncio
async def test_enroll_returns_face_count():
    """POST /enroll detecta faces e retorna photo_id + faces_detected."""
    from app.main import app

    with patch("app.routes.enroll.download_photo", new=AsyncMock(return_value=b"\xff\xd8\xff\x00")), \
         patch("app.routes.enroll.detect_faces", return_value=[make_face(), make_face()]), \
         patch("app.routes.enroll.get_pool", new=AsyncMock(return_value=AsyncMock())), \
         patch("app.routes.enroll.insert_face_embeddings", new=AsyncMock(return_value=2)):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/enroll", json={
                "photo_id": "photo-uuid-1",
                "event_id": "event-uuid-1",
                "tenant_id": "tenant-uuid-1",
                "original_storage_path": "tenant-1/event-1/photo-1.jpg",
            })

    assert response.status_code == 200
    data = response.json()
    assert data["photo_id"] == "photo-uuid-1"
    assert data["faces_detected"] == 2


@pytest.mark.asyncio
async def test_enroll_returns_zero_when_no_faces():
    """POST /enroll retorna faces_detected=0 quando não há faces na foto."""
    from app.main import app

    with patch("app.routes.enroll.download_photo", new=AsyncMock(return_value=b"\xff\xd8\xff\x00")), \
         patch("app.routes.enroll.detect_faces", return_value=[]), \
         patch("app.routes.enroll.get_pool", new=AsyncMock(return_value=AsyncMock())), \
         patch("app.routes.enroll.insert_face_embeddings", new=AsyncMock(return_value=0)):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/enroll", json={
                "photo_id": "photo-uuid-2",
                "event_id": "event-uuid-1",
                "tenant_id": "tenant-uuid-1",
                "original_storage_path": "tenant-1/event-1/photo-2.jpg",
            })

    assert response.status_code == 200
    assert response.json()["faces_detected"] == 0


@pytest.mark.asyncio
async def test_enroll_returns_502_on_storage_error():
    """POST /enroll retorna 502 quando o download da foto falha."""
    from app.main import app

    with patch("app.routes.enroll.download_photo", new=AsyncMock(side_effect=Exception("storage down"))):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/enroll", json={
                "photo_id": "photo-uuid-3",
                "event_id": "event-uuid-1",
                "tenant_id": "tenant-uuid-1",
                "original_storage_path": "tenant-1/event-1/photo-3.jpg",
            })

    assert response.status_code == 502
