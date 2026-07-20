ALTER TABLE public.events ADD COLUMN IF NOT EXISTS session_price_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS included_photo_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS extra_photo_price_cents integer NOT NULL DEFAULT 0;
