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
    # Full implementation in Task 10
    return OcrResponse(detected_numbers=[])
