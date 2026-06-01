ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS logo_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS primary_color     TEXT DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS bio               TEXT;
