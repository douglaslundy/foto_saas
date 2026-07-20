-- supabase/migrations/0021_session_pricing.sql

-- Novo modelo de precificação de ensaios (type='session'): valor fixo do
-- ensaio (cobre um número de fotos incluídas), preço por foto extra além
-- desse número. session_price_cents=0 => ensaio gratuito, sem pagamento.
-- included_photo_count=0 => cliente pode selecionar todas as fotos do
-- ensaio sem limite. Não usado quando type='event' (mantém price_cents
-- como preço por foto, comportamento já existente).
ALTER TABLE events ADD COLUMN IF NOT EXISTS session_price_cents integer NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS included_photo_count integer NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS extra_photo_price_cents integer NOT NULL DEFAULT 0;
