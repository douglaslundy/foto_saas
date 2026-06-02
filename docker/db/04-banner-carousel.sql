CREATE TABLE IF NOT EXISTS public.banner_images (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  title        TEXT,
  subtitle     TEXT,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS banner_images_tenant_id_idx ON public.banner_images (tenant_id);

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS banner_mode TEXT NOT NULL DEFAULT 'static';

GRANT ALL ON public.banner_images TO anon, authenticated, service_role;
