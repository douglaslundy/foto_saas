-- supabase/migrations/0014_tenant_registrations.sql

CREATE TABLE tenant_registrations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  cpf_cnpj    text NOT NULL,
  city        text NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tenant_registrations_tenant_id_idx ON tenant_registrations(tenant_id);

ALTER TABLE tenant_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON tenant_registrations
  FOR ALL USING (auth.role() = 'service_role');
