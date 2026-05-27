import asyncio
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from app.detector import detect_faces
from app.database import get_pool, search_faces
from app.config import settings

router = APIRouter()


class FaceMatch(BaseModel):
    photo_id: str
    face_index: int
    score: float


class SearchResponse(BaseModel):
    matches: list[FaceMatch]


@router.post("/search", response_model=SearchResponse)
async def search(
    selfie: UploadFile = File(...),
    event_id: str = Form(...),
    tenant_id: str = Form(...),
    threshold: Annotated[float, Form(ge=0.0, le=1.0)] = settings.FACE_SIMILARITY_THRESHOLD,
    limit: Annotated[int, Form(ge=1, le=500)] = settings.FACE_SEARCH_LIMIT,
):
    image_bytes = await selfie.read()

    try:
        loop = asyncio.get_event_loop()
        faces = await loop.run_in_executor(None, detect_faces, image_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="Imagem inválida ou formato não suportado.",
        ) from exc

    if not faces:
        raise HTTPException(
            status_code=422,
            detail="Não foi possível detectar um rosto. Tente com boa iluminação e fundo neutro.",
        )

    best_face = max(faces, key=lambda f: f.det_score)

    pool = await get_pool()
    matches = await search_faces(pool, event_id, tenant_id, best_face.embedding, threshold, limit)

    return SearchResponse(matches=[FaceMatch(**m) for m in matches])
