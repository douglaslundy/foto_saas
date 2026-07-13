-- =============================================================
-- FotoSaaS — Inicialização do PostgreSQL
-- Roda antes do GoTrue, cria extensões e roles do Supabase
-- =============================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Roles do Supabase
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOINHERIT CREATEROLE LOGIN PASSWORD 'fotosaas_dev_pass_2024';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin NOINHERIT LOGIN PASSWORD 'fotosaas_dev_pass_2024';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER PASSWORD 'fotosaas_dev_pass_2024';
  END IF;
END
$$;

-- Permissões para o authenticator (usado pelo PostgREST)
GRANT anon          TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role  TO authenticator;

-- Schema auth (GoTrue vai criar as tabelas aqui)
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
GRANT ALL    ON SCHEMA auth TO supabase_auth_admin;
GRANT USAGE  ON SCHEMA auth TO service_role, authenticated, anon, postgres;

-- GoTrue precisa de CREATE no public para sua tabela schema_migrations
GRANT CREATE ON SCHEMA public TO supabase_auth_admin;

-- Define search_path de supabase_auth_admin para auth (evita queries sem prefixo errando)
ALTER ROLE supabase_auth_admin SET search_path TO auth;

-- Schema storage
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
GRANT ALL    ON SCHEMA storage TO supabase_storage_admin;
GRANT USAGE  ON SCHEMA storage TO service_role, authenticated, anon;

-- storage-api (v1.0.6) connects via DATABASE_URL as `postgres` and creates its own
-- tables (buckets/objects/migrations) on first boot owned by `postgres`, not
-- supabase_storage_admin. Without these default privileges, anon/authenticated/
-- service_role only have schema USAGE — every query against those tables fails
-- with 42501 (insufficient_privilege), which storage-api reports as a misleading
-- "row-level security policy" error.
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Permissões padrão no schema public
GRANT USAGE  ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL    ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL    ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
