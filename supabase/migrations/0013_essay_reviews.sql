CREATE TABLE IF NOT EXISTS public.essay_reviews (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id              UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  client_id             UUID        NOT NULL REFERENCES auth.users(id),
  status                TEXT        NOT NULL DEFAULT 'pending_selection'
                                    CHECK (status IN ('pending_selection', 'submitted', 'in_progress', 'delivered')),
  selected_photo_ids    UUID[]      DEFAULT '{}',
  notes                 TEXT,
  payment_status        TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (payment_status IN ('pending', 'paid', 'manual')),
  payment_intent_id     TEXT,
  sent_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at          TIMESTAMPTZ,
  magic_link_expires_at TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries frequentes
CREATE INDEX IF NOT EXISTS essay_reviews_tenant_id_idx ON public.essay_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS essay_reviews_event_id_idx ON public.essay_reviews(event_id);
CREATE INDEX IF NOT EXISTS essay_reviews_client_id_idx ON public.essay_reviews(client_id);
CREATE INDEX IF NOT EXISTS essay_reviews_status_idx ON public.essay_reviews(tenant_id, status);

-- RLS
ALTER TABLE public.essay_reviews ENABLE ROW LEVEL SECURITY;

-- Cliente pode ler e atualizar apenas o próprio review
CREATE POLICY "essay_reviews_client_select" ON public.essay_reviews
  FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "essay_reviews_client_update" ON public.essay_reviews
  FOR UPDATE USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Service role tem acesso total (usado pelas APIs do servidor)
CREATE POLICY "essay_reviews_service_role_all" ON public.essay_reviews
  FOR ALL USING (auth.role() = 'service_role');

-- Grants
GRANT ALL ON public.essay_reviews TO anon, authenticated, service_role;
