-- =============================================================
-- FotoSaaS — Seed de dados iniciais
-- =============================================================
-- Usuários criados:
--
--   admin@fotosaas.com      / admin123       → role: admin (acesso ao /admin)
--   foto@demo.com           / fotosaas123    → role: photographer (dono do tenant demo)
--
-- Tenant demo: slug = "demo"  →  http://localhost:3000/demo
-- =============================================================

-- IDs fixos para reprodutibilidade
-- Tenant demo:         'aaaaaaaa-0000-0000-0000-000000000001'
-- Auth user admin:     'bbbbbbbb-0000-0000-0000-000000000001'
-- Auth user fotógrafo: 'bbbbbbbb-0000-0000-0000-000000000002'
-- Evento demo:         'cccccccc-0000-0000-0000-000000000001'

-- ----------------------------------------------------------
-- 1. Tenant demo
-- ----------------------------------------------------------
INSERT INTO public.tenants (id, name, slug, status)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Demo Fotografia',
  'demo',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------
-- 2. Usuários no Supabase Auth
-- ----------------------------------------------------------

-- 2a. Admin da plataforma
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin@fotosaas.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW(),
  '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

-- 2b. Fotógrafo (dono do tenant demo)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-0000-0000-0000-000000000002',
  'authenticated',
  'authenticated',
  'foto@demo.com',
  crypt('fotosaas123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW(),
  '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------
-- 3. Perfis em public.users
-- ----------------------------------------------------------

-- Admin da plataforma (sem tenant_id — acesso global)
INSERT INTO public.users (id, tenant_id, role, email)
VALUES (
  'bbbbbbbb-0000-0000-0000-000000000001',
  NULL,
  'admin',
  'admin@fotosaas.com'
)
ON CONFLICT (id) DO NOTHING;

-- Fotógrafo vinculado ao tenant demo
INSERT INTO public.users (id, tenant_id, role, email)
VALUES (
  'bbbbbbbb-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'photographer',
  'foto@demo.com'
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------
-- 4. Evento demo (rascunho) para o tenant demo
-- ----------------------------------------------------------
INSERT INTO public.events (
  id,
  tenant_id,
  title,
  slug,
  type,
  status,
  is_public,
  price_cents,
  facial_recognition_enabled,
  created_at
) VALUES (
  'cccccccc-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Casamento Silva & Santos',
  'casamento-silva-santos',
  'event',
  'draft',
  true,
  2500,
  false,
  NOW()
)
ON CONFLICT (id) DO NOTHING;
