from dataclasses import dataclass
import numpy as np


@dataclass
class DetectedFace:
    embedding: np.ndarray  # shape (512,), L2-normalizado
    bounding_box: dict     # {"x1": float, "y1": float, "x2": float, "y2": float}
    det_score: float       # confiança da detecção 0-1
