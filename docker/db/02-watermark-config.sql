CREATE TABLE IF NOT EXISTS public.watermark_configs (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  type               TEXT        NOT NULL DEFAULT 'text',
  text_content       TEXT,
  font               TEXT        NOT NULL DEFAULT 'sans-serif',
  font_size          INTEGER     NOT NULL DEFAULT 24,
  color              TEXT        NOT NULL DEFAULT '#ffffff',
  opacity            REAL        NOT NULL DEFAULT 0.6,
  position           TEXT        NOT NULL DEFAULT 'bottom-right',
  image_storage_path TEXT,
  image_size_percent INTEGER     NOT NULL DEFAULT 20,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT ALL ON public.watermark_configs TO anon, authenticated, service_role;
