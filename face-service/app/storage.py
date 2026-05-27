import httpx
from app.config import settings


async def download_photo(storage_path: str) -> bytes:
    """Baixa uma foto do bucket privado photos-original via Supabase Storage REST API."""
    url = f"{settings.SUPABASE_URL}/storage/v1/object/photos-original/{storage_path}"
    headers = {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.content
