-- Permissão e taxa interna por sub-fotógrafo (também usado pela Task 6+7)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS can_create_events           BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS internal_commission_percent INTEGER;

-- Configuração de auto-aprovação
INSERT INTO public.system_settings (key, value)
VALUES ('auto_approve_sub_events', 'false')
ON CONFLICT (key) DO NOTHING;

COMMENT ON COLUMN public.events.status IS 'draft | published | archived | pending_approval';
