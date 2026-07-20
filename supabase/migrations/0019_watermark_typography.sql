-- supabase/migrations/0019_watermark_typography.sql

-- Controles adicionais de tipografia da marca d'água: espessura da fonte e
-- espaçamento horizontal/vertical entre repetições no modo "tiled".
ALTER TABLE watermark_configs ADD COLUMN IF NOT EXISTS font_weight integer NOT NULL DEFAULT 700
  CHECK (font_weight BETWEEN 100 AND 900);
ALTER TABLE watermark_configs ADD COLUMN IF NOT EXISTS spacing_x integer NOT NULL DEFAULT 40
  CHECK (spacing_x BETWEEN 0 AND 500);
ALTER TABLE watermark_configs ADD COLUMN IF NOT EXISTS spacing_y integer NOT NULL DEFAULT 80
  CHECK (spacing_y BETWEEN 0 AND 500);
