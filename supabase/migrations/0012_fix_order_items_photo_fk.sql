-- Corrige FK de order_items.photo_id para ON DELETE SET NULL
-- Sem isso, excluir uma foto que foi comprada gera erro de FK violation

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_photo_id_fkey;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_photo_id_fkey
  FOREIGN KEY (photo_id) REFERENCES public.photos(id) ON DELETE SET NULL;
