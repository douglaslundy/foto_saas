from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.database import (
    get_pool,
    delete_faces_by_photo,
    delete_faces_by_event,
    delete_faces_by_tenant,
)

router = APIRouter()


class DeleteFacesRequest(BaseModel):
    photo_id: Optional[str] = None
    event_id: Optional[str] = None
    tenant_id: Optional[str] = None


class DeleteFacesResponse(BaseModel):
    deleted: int


@router.delete("/faces", response_model=DeleteFacesResponse)
async def delete_faces(request: DeleteFacesRequest):
    pool = await get_pool()

    if request.photo_id:
        deleted = await delete_faces_by_photo(pool, request.photo_id)
    elif request.event_id and request.tenant_id:
        deleted = await delete_faces_by_event(pool, request.event_id, request.tenant_id)
    elif request.tenant_id:
        deleted = await delete_faces_by_tenant(pool, request.tenant_id)
    else:
        raise HTTPException(
            status_code=400,
            detail="Forneça photo_id, event_id+tenant_id, ou tenant_id.",
        )

    return DeleteFacesResponse(deleted=deleted)
