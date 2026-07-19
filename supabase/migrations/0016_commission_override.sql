-- supabase/migrations/0016_commission_override.sql

-- Override de comissão por tenant (usado em /admin/tenants/[id] e /api/tenant/commission)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS commission_override_percent integer
  CHECK (commission_override_percent IS NULL OR (commission_override_percent BETWEEN 0 AND 100));

-- Taxa global padrão usada quando o tenant não tem override
INSERT INTO system_settings (key, value)
VALUES ('global_commission_percent', '10')
ON CONFLICT (key) DO NOTHING;
