import asyncio
import re

import cv2
import numpy as np
import pytesseract
from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

router = APIRouter()


class BibMatch(BaseModel):
    bib_number: str
    confidence: float


class OcrResponse(BaseModel):
    detected_numbers: list[BibMatch]


@router.post("/ocr", response_model=OcrResponse)
async def ocr_bib(image: UploadFile = File(...)):
    """Detecta números de peito (bib numbers) em imagens via Tesseract OCR."""
    image_bytes = await image.read()
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return OcrResponse(detected_numbers=[])

    def _run_ocr(image: np.ndarray) -> list[BibMatch]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        data = pytesseract.image_to_data(
            gray,
            output_type=pytesseract.Output.DICT,
            config="--psm 11 -c tessedit_char_whitelist=0123456789",
        )
        out: list[BibMatch] = []
        for text, conf_str in zip(data["text"], data["conf"]):
            text = str(text).strip()
            if not re.match(r"^\d+$", text):
                continue
            try:
                confidence = float(conf_str) / 100.0
            except (ValueError, TypeError):
                continue
            if confidence >= 0.5:
                out.append(BibMatch(bib_number=text, confidence=round(confidence, 4)))
        return out

    loop = asyncio.get_running_loop()
    results = await loop.run_in_executor(None, _run_ocr, img)
    return OcrResponse(detected_numbers=results)
