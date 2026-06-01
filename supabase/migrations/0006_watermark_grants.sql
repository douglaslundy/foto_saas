-- Grants para watermark_configs — PostgREST precisa de acesso via authenticator
GRANT ALL ON public.watermark_configs TO anon, authenticated, service_role, authenticator;
