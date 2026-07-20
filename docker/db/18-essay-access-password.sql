ALTER TABLE public.essay_reviews ADD COLUMN IF NOT EXISTS access_password text;

NOTIFY pgrst, 'reload schema';
