from app.models import DetectedFace
import numpy as np


class FaceDetector:
    def __init__(self, model=None):
        self._model = model  # injetável para testes; None = lazy load em produção

    def _get_model(self):
        if self._model is None:
            import insightface
            self._model = insightface.app.FaceAnalysis(
                name="buffalo_l",
                providers=["CPUExecutionProvider"],
            )
            self._model.prepare(ctx_id=-1)
        return self._model

    def detect(self, image_bytes: bytes) -> list[DetectedFace]:
        import cv2

        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image")
        faces = self._get_model().get(img)
        return [
            DetectedFace(
                embedding=np.array(face.embedding, dtype=np.float32),
                bounding_box={
                    "x1": float(face.bbox[0]),
                    "y1": float(face.bbox[1]),
                    "x2": float(face.bbox[2]),
                    "y2": float(face.bbox[3]),
                },
                det_score=float(face.det_score),
            )
            for face in faces
        ]


# Singleton com lazy load — o modelo só é baixado na primeira chamada real
detector = FaceDetector()


def detect_faces(image_bytes: bytes, model=None) -> list[DetectedFace]:
    """Wrapper funcional para facilitar mock em testes de endpoint."""
    d = FaceDetector(model=model) if model is not None else detector
    return d.detect(image_bytes)
