import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_delete_by_photo_id():
    """DELETE /faces com photo_id deleta embeddings dessa foto."""
    from app.main import app

    with patch("app.routes.lgpd.get_pool", new=AsyncMock(return_value=AsyncMock())), \
         patch("app.routes.lgpd.delete_faces_by_photo", new=AsyncMock(return_value=3)):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.request(
                "DELETE", "/faces", json={"photo_id": "photo-uuid-1"}
            )

    assert response.status_code == 200
    assert response.json()["deleted"] == 3


@pytest.mark.asyncio
async def test_delete_by_event_and_tenant():
    """DELETE /faces com event_id + tenant_id deleta embeddings do evento."""
    from app.main import app

    with patch("app.routes.lgpd.get_pool", new=AsyncMock(return_value=AsyncMock())), \
         patch("app.routes.lgpd.delete_faces_by_event", new=AsyncMock(return_value=50)):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.request(
                "DELETE", "/faces",
                json={"event_id": "event-uuid-1", "tenant_id": "tenant-uuid-1"},
            )

    assert response.status_code == 200
    assert response.json()["deleted"] == 50


@pytest.mark.asyncio
async def test_delete_by_tenant_only():
    """DELETE /faces com tenant_id deleta todos os embeddings do tenant (right to be forgotten)."""
    from app.main import app

    with patch("app.routes.lgpd.get_pool", new=AsyncMock(return_value=AsyncMock())), \
         patch("app.routes.lgpd.delete_faces_by_tenant", new=AsyncMock(return_value=200)):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.request(
                "DELETE", "/faces", json={"tenant_id": "tenant-uuid-1"}
            )

    assert response.status_code == 200
    assert response.json()["deleted"] == 200


@pytest.mark.asyncio
async def test_delete_returns_400_without_filter():
    """DELETE /faces sem filtro retorna 400 — nunca deleta tudo sem critério."""
    from app.main import app

    with patch("app.routes.lgpd.get_pool", new=AsyncMock(return_value=AsyncMock())):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.request("DELETE", "/faces", json={})

    assert response.status_code == 400
