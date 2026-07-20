-- supabase/migrations/0022_essay_review_delivery.sql

-- Marca quando o fotógrafo enviou a entrega final (fotos tratadas) ao cliente.
ALTER TABLE essay_reviews ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
