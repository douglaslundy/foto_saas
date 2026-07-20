-- supabase/migrations/0017_photo_rotation_and_compression.sql

-- Rotação manual aplicada pelo fotógrafo (além da correção automática de orientação EXIF)
ALTER TABLE photos ADD COLUMN IF NOT EXISTS rotation_degrees integer NOT NULL DEFAULT 0
  CHECK (rotation_degrees IN (0, 90, 180, 270));

-- Toggle global de compressão das fotos exibidas/vendidas (preview). Habilitado por padrão.
INSERT INTO system_settings (key, value)
VALUES ('photo_compression_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
