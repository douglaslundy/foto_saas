ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS footer_text        TEXT,
  ADD COLUMN IF NOT EXISTS footer_address     TEXT,
  ADD COLUMN IF NOT EXISTS footer_phone       TEXT,
  ADD COLUMN IF NOT EXISTS footer_whatsapp    TEXT,
  ADD COLUMN IF NOT EXISTS footer_instagram   TEXT,
  ADD COLUMN IF NOT EXISTS footer_facebook    TEXT,
  ADD COLUMN IF NOT EXISTS footer_email       TEXT;
