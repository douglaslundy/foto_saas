import pytest
import numpy as np
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock


def make_image_bytes() -> bytes:
    return b"\xff\xd8\xff\xe0" + b"\x00" * 50


@pytest.mark.asyncio
async def test_ocr_returns_detected_numbers():
    """POST /ocr retorna bib numbers detectados com confidence acima de 0.5."""
    from app.main import app

    mock_tesseract_data = {
        "text": ["", "42", "abc", "7", ""],
        "conf": ["-1", "90", "80", "60", "-1"],
    }

    with patch("app.routes.ocr.cv2") as mock_cv2, \
         patch("app.routes.ocr.pytesseract") as mock_tess:

        mock_cv2.imdecode.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
        mock_cv2.cvtColor.return_value = np.zeros((100, 100), dtype=np.uint8)
        mock_cv2.IMREAD_COLOR = 1
        mock_cv2.COLOR_BGR2GRAY = 6
        mock_tess.Output = MagicMock()
        mock_tess.Output.DICT = "dict"
        mock_tess.image_to_data.return_value = mock_tesseract_data

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/ocr",
                files={"image": ("photo.jpg", make_image_bytes(), "image/jpeg")},
            )

    assert response.status_code == 200
    data = response.json()
    numbers = [m["bib_number"] for m in data["detected_numbers"]]
    # "42" (conf=90%) and "7" (conf=60%) should appear; "abc" is ignored (not numeric)
    assert "42" in numbers
    assert "7" in numbers
    assert "abc" not in numbers


@pytest.mark.asyncio
async def test_ocr_returns_empty_for_invalid_image():
    """POST /ocr retorna lista vazia quando a imagem não pode ser decodificada."""
    from app.main import app

    with patch("app.routes.ocr.cv2") as mock_cv2:
        mock_cv2.imdecode.return_value = None
        mock_cv2.IMREAD_COLOR = 1

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/ocr",
                files={"image": ("bad.bin", b"\x00\x01\x02", "application/octet-stream")},
            )

    assert response.status_code == 200
    assert response.json()["detected_numbers"] == []


@pytest.mark.asyncio
async def test_ocr_ignores_low_confidence_detections():
    """POST /ocr ignora números com confidence abaixo de 50%."""
    from app.main import app

    mock_tesseract_data = {
        "text": ["99", "123"],
        "conf": ["45", "30"],  # both below 50%
    }

    with patch("app.routes.ocr.cv2") as mock_cv2, \
         patch("app.routes.ocr.pytesseract") as mock_tess:

        mock_cv2.imdecode.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
        mock_cv2.cvtColor.return_value = np.zeros((100, 100), dtype=np.uint8)
        mock_cv2.IMREAD_COLOR = 1
        mock_cv2.COLOR_BGR2GRAY = 6
        mock_tess.Output = MagicMock()
        mock_tess.Output.DICT = "dict"
        mock_tess.image_to_data.return_value = mock_tesseract_data

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/ocr",
                files={"image": ("photo.jpg", make_image_bytes(), "image/jpeg")},
            )

    assert response.status_code == 200
    assert response.json()["detected_numbers"] == []
