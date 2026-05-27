# face-service/tests/test_storage.py
import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_download_photo_returns_bytes():
    """download_photo retorna bytes da foto quando Supabase responde 200."""
    from app import storage

    mock_response = MagicMock()
    mock_response.content = b"fake_image_bytes"
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.storage.httpx.AsyncClient", return_value=mock_client), \
         patch("app.storage.settings") as mock_settings:
        mock_settings.SUPABASE_URL = "https://test.supabase.co"
        mock_settings.SUPABASE_SERVICE_ROLE_KEY = "test-key"

        result = await storage.download_photo("tenant-1/event-1/photo-1.jpg")

    assert result == b"fake_image_bytes"
    call_args = mock_client.get.call_args
    assert "photos-original/tenant-1/event-1/photo-1.jpg" in call_args[0][0]
    assert "Bearer test-key" in call_args[1]["headers"]["Authorization"]


@pytest.mark.asyncio
async def test_download_photo_raises_on_http_error():
    """download_photo levanta HTTPStatusError em resposta de erro do Supabase."""
    from app import storage

    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "404 Not Found", request=MagicMock(), response=MagicMock()
    )

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.storage.httpx.AsyncClient", return_value=mock_client), \
         patch("app.storage.settings"):

        with pytest.raises(httpx.HTTPStatusError):
            await storage.download_photo("tenant-1/event-1/missing.jpg")
