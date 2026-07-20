ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;

NOTIFY pgrst, 'reload schema';
