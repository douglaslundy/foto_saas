import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.database import close_pool, delete_expired_embeddings, get_pool
from app.routes import enroll, search, lgpd, ocr


async def _cleanup_loop() -> None:
    """Deleta embeddings expirados diariamente (LGPD)."""
    while True:
        await asyncio.sleep(86400)  # 24h
        try:
            pool = await get_pool()
            deleted = await delete_expired_embeddings(pool)
            if deleted > 0:
                print(f"[cleanup] Deleted {deleted} expired face embeddings")
        except Exception as exc:
            print(f"[cleanup] Error during expired embedding cleanup: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(_cleanup_loop())
    yield
    await close_pool()


app = FastAPI(title="FotoSaaS Face Service", version="1.0.0", lifespan=lifespan)

app.include_router(enroll.router)
app.include_router(search.router)
app.include_router(lgpd.router)
app.include_router(ocr.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
