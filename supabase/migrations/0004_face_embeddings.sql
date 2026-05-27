-- Habilitar extensão pgvector (requer Supabase com pgvector ativo)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela de embeddings faciais
CREATE TABLE IF NOT EXISTS face_embeddings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id    UUID        NOT NULL,
  event_id    UUID        NOT NULL,
  tenant_id   UUID        NOT NULL,
  face_index  SMALLINT    NOT NULL DEFAULT 0,
  embedding   vector(512) NOT NULL,
  bounding_box JSONB      NOT NULL DEFAULT '{}',
  det_score   REAL        NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para filtros por evento/tenant/foto
CREATE INDEX IF NOT EXISTS face_embeddings_event_id_idx  ON face_embeddings (event_id);
CREATE INDEX IF NOT EXISTS face_embeddings_tenant_id_idx ON face_embeddings (tenant_id);
CREATE INDEX IF NOT EXISTS face_embeddings_photo_id_idx  ON face_embeddings (photo_id);
CREATE INDEX IF NOT EXISTS face_embeddings_expires_at_idx
  ON face_embeddings (expires_at) WHERE expires_at IS NOT NULL;

-- Índice HNSW para busca vetorial por similaridade coseno
CREATE INDEX IF NOT EXISTS face_embeddings_embedding_hnsw
  ON face_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
