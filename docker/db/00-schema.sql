-- =============================================================
-- FotoSaaS — Schema público completo
-- Rodado em /docker-entrypoint-initdb.d/migrations/ após o
-- supabase/postgres configurar auth + storage schemas.
-- =============================================================

-- Extensões extras
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------
-- Tenants (fotógrafos / empresas)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  status        TEXT        NOT NULL DEFAULT 'active',
  custom_domain TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- Perfis de usuário (espelha auth.users com dados extras)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'sub_photographer',
  email      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- Eventos e ensaios
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title                      TEXT        NOT NULL,
  slug                       TEXT        NOT NULL,
  type                       TEXT        NOT NULL DEFAULT 'event',
  event_date                 DATE,
  description                TEXT,
  status                     TEXT        NOT NULL DEFAULT 'draft',
  is_public                  BOOLEAN     NOT NULL DEFAULT TRUE,
  password_hash              TEXT,
  price_cents                INTEGER     NOT NULL DEFAULT 0,
  facial_recognition_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

-- ----------------------------------------------------------
-- Fotos
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.photos (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status                TEXT        NOT NULL DEFAULT 'pending',
  public_storage_path   TEXT,
  original_storage_path TEXT,
  bib_number            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- Carrinho (sem necessidade de conta)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cart_items (
  session_id TEXT        NOT NULL,
  photo_id   UUID        NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, photo_id)
);

-- ----------------------------------------------------------
-- Pedidos
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id      UUID        REFERENCES auth.users(id),
  client_email        TEXT,
  status              TEXT        NOT NULL DEFAULT 'pending',
  total_cents         INTEGER     NOT NULL DEFAULT 0,
  payment_method      TEXT,
  payment_provider_id TEXT,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- Itens do pedido
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID    NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  photo_id    UUID    REFERENCES public.photos(id),
  event_id    UUID    REFERENCES public.events(id),
  price_cents INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------
-- Embeddings faciais (pgvector)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.face_embeddings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id     UUID        NOT NULL,
  event_id     UUID        NOT NULL,
  tenant_id    UUID        NOT NULL,
  face_index   SMALLINT    NOT NULL DEFAULT 0,
  embedding    vector(512) NOT NULL,
  bounding_box JSONB       NOT NULL DEFAULT '{}',
  det_score    REAL        NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS face_embeddings_event_id_idx ON public.face_embeddings (event_id);
CREATE INDEX IF NOT EXISTS face_embeddings_tenant_id_idx ON public.face_embeddings (tenant_id);
CREATE INDEX IF NOT EXISTS face_embeddings_photo_id_idx ON public.face_embeddings (photo_id);
CREATE INDEX IF NOT EXISTS face_embeddings_expires_at_idx
  ON public.face_embeddings (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS face_embeddings_embedding_hnsw
  ON public.face_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ----------------------------------------------------------
-- Índices gerais
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS events_tenant_id_idx    ON public.events (tenant_id);
CREATE INDEX IF NOT EXISTS photos_event_id_idx     ON public.photos (event_id);
CREATE INDEX IF NOT EXISTS photos_tenant_id_idx    ON public.photos (tenant_id);
CREATE INDEX IF NOT EXISTS orders_client_email_idx ON public.orders (client_email);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);

-- ----------------------------------------------------------
-- Permissões para as roles do Supabase
-- ----------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
