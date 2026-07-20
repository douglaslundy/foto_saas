-- supabase/migrations/0020_photos_updated_at.sql

-- Usado para invalidar cache do navegador (thumbnail/preview) quando a foto
-- e reprocessada (girar, reaplicar marca d'agua) — a URL do arquivo nao muda,
-- e o Storage serve com Cache-Control: max-age=3600, entao sem isso o
-- navegador continua mostrando a versao antiga por ate 1h mesmo com F5.
ALTER TABLE photos ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
