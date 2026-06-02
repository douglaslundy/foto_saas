CREATE TABLE IF NOT EXISTS public.payouts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount_cents INTEGER     NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending',
  period_start DATE        NOT NULL,
  period_end   DATE        NOT NULL,
  note         TEXT,
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payouts_tenant_id_idx ON public.payouts (tenant_id);
CREATE INDEX IF NOT EXISTS payouts_status_idx    ON public.payouts (status);

GRANT ALL ON public.payouts TO anon, authenticated, service_role;
