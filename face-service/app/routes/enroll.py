import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from app.detector import detect_faces
from app.storage import download_photo
from app.database import get_pool, insert_face_embeddings
from app.config import settings

router = APIRouter()


class EnrollRequest(BaseModel):
    photo_id: str
    event_id: str
    tenant_id: str
    original_storage_path: str


class EnrollResponse(BaseModel):
    photo_id: str
    faces_detected: int


@router.post("/enroll", response_model=EnrollResponse)
async def enroll(request: EnrollRequest):
    try:
        image_bytes = await download_photo(request.original_storage_path)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to download photo: {exc}")

    try:
        loop = asyncio.get_running_loop()
        faces = await loop.run_in_executor(None, detect_faces, image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Imagem inválida ou formato não suportado.") from exc

    expires_at: datetime | None = None
    if settings.FACE_RETENTION_DAYS > 0:
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.FACE_RETENTION_DAYS)

    pool = await get_pool()
    count = await insert_face_embeddings(
        pool, request.photo_id, request.event_id, request.tenant_id, faces, expires_at
    )
    return EnrollResponse(photo_id=request.photo_id, faces_detected=count)
