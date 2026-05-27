import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    SUPABASE_URL: str = os.environ["SUPABASE_URL"]
    SUPABASE_SERVICE_ROLE_KEY: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    DATABASE_URL: str = os.environ["DATABASE_URL"]
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379")
    FACE_RETENTION_DAYS: int = int(os.environ.get("FACE_RETENTION_DAYS", "90"))
    FACE_SIMILARITY_THRESHOLD: float = float(os.environ.get("FACE_SIMILARITY_THRESHOLD", "0.6"))
    FACE_SEARCH_LIMIT: int = int(os.environ.get("FACE_SEARCH_LIMIT", "100"))


settings = Settings()
