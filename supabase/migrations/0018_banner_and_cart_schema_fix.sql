-- supabase/migrations/0018_banner_and_cart_schema_fix.sql

-- Colunas de banner estático usadas pela página pública do tenant e pelo
-- formulário de configurações do site, mas nunca criadas por uma migration
-- (causava 404 na página pública /[tenant] por erro de coluna inexistente).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS banner_image_path text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS banner_title text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS banner_subtitle text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS banner_cta_text text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS banner_cta_url text;

-- cart_items ficou com um schema minimo (session_id, photo_id, created_at) mas o
-- código (rotas /api/cart, /api/checkout) sempre esperou id, event_id e price_cents.
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS price_cents integer;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_pkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_id_pkey'
  ) THEN
    ALTER TABLE cart_items DROP CONSTRAINT cart_items_pkey;
    ALTER TABLE cart_items ADD CONSTRAINT cart_items_id_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_session_photo_key'
  ) THEN
    ALTER TABLE cart_items ADD CONSTRAINT cart_items_session_photo_key UNIQUE (session_id, photo_id);
  END IF;
END $$;

-- Backfill de itens de carrinho pré-existentes (se houver) a partir da foto
UPDATE cart_items ci
SET event_id = p.event_id
FROM photos p
WHERE ci.photo_id = p.id AND ci.event_id IS NULL;
