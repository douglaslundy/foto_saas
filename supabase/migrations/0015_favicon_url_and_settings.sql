-- supabase/migrations/0015_favicon_url_and_settings.sql

-- Adicionar favicon_url aos tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS favicon_url text;

-- Criar bucket platform-assets (público)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'platform-assets',
  'platform-assets',
  true,
  524288, -- 512 KB
  ARRAY['image/png', 'image/x-icon', 'image/svg+xml', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage: leitura pública, escrita apenas service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'platform_assets_public_read'
  ) THEN
    CREATE POLICY "platform_assets_public_read" ON storage.objects
      FOR SELECT USING (bucket_id = 'platform-assets');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'platform_assets_service_insert'
  ) THEN
    CREATE POLICY "platform_assets_service_insert" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'platform-assets' AND auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'platform_assets_service_update'
  ) THEN
    CREATE POLICY "platform_assets_service_update" ON storage.objects
      FOR UPDATE USING (bucket_id = 'platform-assets' AND auth.role() = 'service_role');
  END IF;
END $$;

-- Pré-inserir as novas chaves em system_settings (com valor vazio)
INSERT INTO system_settings (key, value)
VALUES
  ('platform_name', ''),
  ('platform_favicon_url', '')
ON CONFLICT (key) DO NOTHING;
