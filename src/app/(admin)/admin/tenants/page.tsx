import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { TenantRowActions } from './_components/tenant-row-actions'

type Tenant = {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
}

export default async function TenantsPage() {
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenants } = (await (adminClient as any)
    .from('tenants')
    .select('id, name, slug, status, created_at')
    .order('created_at', { ascending: false })) as { data: Tenant[] | null }

  const statusConfig: Record<string, { label: string; className: string }> = {
    active: {
      label: 'Ativo',
      className: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
    },
    suspended: {
      label: 'Suspenso',
      className: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
    },
    pending: {
      label: 'Pendente',
      className: 'bg-[var(--color-blue-light)] text-[var(--color-blue)]',
    },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Tenants
          </h1>
          <p className="text-[var(--color-ink-muted)] text-sm mt-1">
            {tenants?.length ?? 0} estúdio{tenants?.length !== 1 ? 's' : ''} cadastrado{tenants?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/admin/tenants/novo"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
        >
          + Novo Tenant
        </Link>
      </div>

      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        {/* Table header */}
        <div className="bg-[var(--color-surface-alt)] px-6 py-3 border-b border-[var(--color-border-strong)] grid grid-cols-[2fr_1fr_auto_auto_auto] gap-4 items-center">
          {['Estúdio', 'Slug', 'Criado em', 'Status', 'Ações'].map((h) => (
            <span
              key={h}
              className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-muted)]"
            >
              {h}
            </span>
          ))}
        </div>

        {/* Table rows */}
        <div className="divide-y divide-[var(--color-border)]">
          {(tenants ?? []).map((t) => {
            const sc = statusConfig[t.status]
            return (
              <div
                key={t.id}
                className="px-6 py-4 grid grid-cols-[2fr_1fr_auto_auto_auto] gap-4 items-center hover:bg-[var(--color-surface)] transition-colors"
              >
                <p className="text-sm font-semibold text-[var(--color-ink)]">{t.name}</p>
                <p className="text-sm font-mono text-[var(--color-ink-muted)]">{t.slug}</p>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  {new Date(t.created_at).toLocaleDateString('pt-BR')}
                </p>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    sc?.className ?? 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)] border border-[var(--color-border-strong)]'
                  }`}
                >
                  {sc?.label ?? t.status}
                </span>
                <TenantRowActions tenantId={t.id} currentStatus={t.status} />
              </div>
            )
          })}
          {(tenants ?? []).length === 0 && (
            <p className="px-6 py-10 text-sm text-[var(--color-ink-muted)] text-center">
              Nenhum tenant cadastrado.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
