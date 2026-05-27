import numpy as np
import pytest
import sys
from unittest.mock import MagicMock, patch


def make_mock_face(embedding=None, bbox=None, det_score=0.95):
    face = MagicMock()
    face.embedding = embedding if embedding is not None else np.zeros(512, dtype=np.float32)
    face.bbox = bbox if bbox is not None else np.array([10.0, 20.0, 100.0, 120.0])
    face.det_score = det_score
    return face


def test_detect_returns_detected_face_list():
    """detect_faces retorna lista de DetectedFace a partir do output do InsightFace."""
    from app.detector import FaceDetector
    from app.models import DetectedFace

    mock_model = MagicMock()
    mock_model.get.return_value = [make_mock_face()]
    detector = FaceDetector(model=mock_model)

    mock_cv2 = MagicMock()
    mock_cv2.imdecode.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
    mock_cv2.IMREAD_COLOR = 1

    with patch.dict(sys.modules, {"cv2": mock_cv2}):
        faces = detector.detect(b"\xff\xd8\xff\x00" * 10)

    assert len(faces) == 1
    f = faces[0]
    assert isinstance(f, DetectedFace)
    assert f.det_score == 0.95
    assert f.bounding_box == {"x1": 10.0, "y1": 20.0, "x2": 100.0, "y2": 120.0}
    assert f.embedding.shape == (512,)


def test_detect_returns_empty_list_when_no_faces():
    """detect_faces retorna [] quando InsightFace não encontra faces."""
    from app.detector import FaceDetector

    mock_model = MagicMock()
    mock_model.get.return_value = []
    detector = FaceDetector(model=mock_model)

    mock_cv2 = MagicMock()
    mock_cv2.imdecode.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
    mock_cv2.IMREAD_COLOR = 1

    with patch.dict(sys.modules, {"cv2": mock_cv2}):
        faces = detector.detect(b"\xff\xd8\xff\x00" * 10)

    assert faces == []


def test_detect_raises_on_invalid_image():
    """detect_faces levanta ValueError quando os bytes não formam uma imagem válida."""
    from app.detector import FaceDetector

    mock_model = MagicMock()
    detector = FaceDetector(model=mock_model)

    mock_cv2 = MagicMock()
    mock_cv2.imdecode.return_value = None  # cv2 retorna None em imagem inválida
    mock_cv2.IMREAD_COLOR = 1

    with patch.dict(sys.modules, {"cv2": mock_cv2}):
        with pytest.raises(ValueError, match="Could not decode image"):
            detector.detect(b"not_an_image")


def test_detect_multiple_faces():
    """detect_faces retorna DetectedFace para cada face detectada."""
    from app.detector import FaceDetector

    mock_model = MagicMock()
    mock_model.get.return_value = [
        make_mock_face(det_score=0.98),
        make_mock_face(det_score=0.85),
    ]
    detector = FaceDetector(model=mock_model)

    mock_cv2 = MagicMock()
    mock_cv2.imdecode.return_value = np.zeros((200, 200, 3), dtype=np.uint8)
    mock_cv2.IMREAD_COLOR = 1

    with patch.dict(sys.modules, {"cv2": mock_cv2}):
        faces = detector.detect(b"\xff\xd8\xff\x00" * 10)

    assert len(faces) == 2
    assert faces[0].det_score == 0.98
    assert faces[1].det_score == 0.85
