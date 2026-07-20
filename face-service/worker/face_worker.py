import asyncio
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

# Imports after load_dotenv so config.py finds the env vars
from app.config import settings
from app.detector import detect_faces
from app.storage import download_photo
from app.database import get_pool, insert_face_embeddings


async def process_face_indexing_job(job, token):
    """Processa um job da face-indexing-queue: baixa foto, detecta faces, grava embeddings."""
    data = job.data
    photo_id: str = data["photo_id"]
    event_id: str = data["event_id"]
    tenant_id: str = data["tenant_id"]
    storage_path: str = data["original_storage_path"]

    print(f"[face-worker] Processing photo {photo_id} (event={event_id})")

    try:
        image_bytes = await download_photo(storage_path)
    except Exception as exc:
        print(f"[face-worker] ✗ photo {photo_id}: download failed — {exc}")
        raise

    try:
        loop = asyncio.get_running_loop()
        faces = await loop.run_in_executor(None, detect_faces, image_bytes)
    except Exception as exc:
        print(f"[face-worker] ✗ photo {photo_id}: face detection failed — {exc}")
        raise

    expires_at: datetime | None = None
    if settings.FACE_RETENTION_DAYS > 0:
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.FACE_RETENTION_DAYS)

    try:
        pool = await get_pool()
        count = await insert_face_embeddings(pool, photo_id, event_id, tenant_id, faces, expires_at)
    except Exception as exc:
        print(f"[face-worker] ✗ photo {photo_id}: DB insert failed — {exc}")
        raise

    print(f"[face-worker] ✓ photo {photo_id}: {count} faces indexed")
    return {"faces_indexed": count}


async def main():
    from bullmq import Worker

    worker = Worker(
        "face-indexing",
        process_face_indexing_job,
        {"connection": settings.REDIS_URL, "concurrency": 2},
    )
    print(f"[face-worker] Listening on queue 'face-indexing' (Redis: {settings.REDIS_URL})...")
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
