import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { StatusToggleButton } from './_components/status-toggle-button'
import { DeleteTenantButton } from './_components/delete-tenant-button'
import { CommissionOverrideSection } from './_components/commission-override-section'

type Props = { params: Promise<{ id: string }> }

type Tenant = {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
  commission_override_percent: number | null
}

type Member = { id: string; email: string; role: string }
type Event = { id: string; title: string; slug: string; status: string; type: string }

export default async function TenantDetailPage({ params }: Props) {
  const { id } = await params
  const adminClient = createAdminClient()

  const [tenantResult, membersResult, eventsResult, globalSettingResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('tenants')
      .select('id, name, slug, status, created_at, commission_override_percent')
      .eq('id', id)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('users')
      .select('id, email, role')
      .eq('tenant_id', id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('events')
      .select('id, title, slug, status, type')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient as any)
      .from('system_settings')
      .select('value')
      .eq('key', 'global_commission_percent')
      .single(),
  ])

  const tenant = tenantResult.data as Tenant | null
  if (!tenant) notFound()

  const members = (membersResult.data ?? []) as Member[]
  const events = (eventsResult.data ?? []) as Event[]
  const globalRate = parseInt(globalSettingResult.data?.value ?? '10', 10)

  const roleLabel: Record<string, string> = {
    photographer: 'Fotógrafo',
    sub_photographer: 'Sub-fotógrafo',
    admin: 'Admin',
  }

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
      className: 'bg-[var(--color-gold-light)] text-[var(--color-gold)]',
    },
  }

  const sc = statusConfig[tenant.status]

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/tenants"
            className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
          >
            ← Voltar para Tenants
          </Link>
          <h1
            className="text-3xl font-bold tracking-tight text-[var(--color-ink)] mt-1"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {tenant.name}
          </h1>
          <p className="text-[var(--color-ink-muted)] text-sm mt-1 font-mono">
            {tenant.slug} · Criado em {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            sc?.className ?? 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)]'
          }`}
        >
          {sc?.label ?? tenant.status}
        </span>
      </div>

      {/* Quick actions */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-5"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-3"
        >
          Ações
        </p>
        <div className="flex gap-3">
          <StatusToggleButton tenantId={tenant.id} currentStatus={tenant.status} />
        </div>
      </div>

      {/* Members card */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)] flex items-center justify-between">
          <h2
            className="text-lg font-semibold text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Membros
          </h2>
          <span className="text-xs font-semibold text-[var(--color-ink-muted)] bg-[var(--color-surface-alt)] px-2.5 py-1 rounded-full">
            {members.length}
          </span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {members.length === 0 ? (
            <p className="px-6 py-8 text-sm text-[var(--color-ink-muted)] text-center">
              Nenhum membro encontrado.
            </p>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="px-6 py-3.5 flex items-center justify-between hover:bg-[var(--color-surface)] transition-colors"
              >
                <span className="text-sm text-[var(--color-ink)]">{m.email}</span>
                <span className="text-xs font-medium text-[var(--color-ink-muted)] bg-[var(--color-surface-alt)] px-2.5 py-1 rounded-full">
                  {roleLabel[m.role] ?? m.role}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Events card */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)] flex items-center justify-between">
          <h2
            className="text-lg font-semibold text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Eventos
          </h2>
          <span className="text-xs font-semibold text-[var(--color-ink-muted)] bg-[var(--color-surface-alt)] px-2.5 py-1 rounded-full">
            {events.length}
          </span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {events.length === 0 ? (
            <p className="px-6 py-8 text-sm text-[var(--color-ink-muted)] text-center">
              Nenhum evento encontrado.
            </p>
          ) : (
            events.map((e) => (
              <div
                key={e.id}
                className="px-6 py-3.5 flex items-center justify-between hover:bg-[var(--color-surface)] transition-colors"
              >
                <span className="text-sm font-semibold text-[var(--color-ink)]">{e.title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-ink-muted)]">
                    {e.type === 'event' ? 'Evento' : 'Ensaio'}
                  </span>
                  <span className="text-xs font-medium bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)] px-2.5 py-1 rounded-full">
                    {e.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Commission section */}
      <CommissionOverrideSection
        tenantId={tenant.id}
        currentOverride={tenant.commission_override_percent}
        globalRate={globalRate}
      />

      {/* Danger zone */}
      <div className="border border-destructive/50 rounded-lg p-6 space-y-3">
        <h2 className="text-base font-semibold text-destructive">Zona de perigo</h2>
        <p className="text-sm text-muted-foreground">
          Excluir este tenant remove permanentemente todos os eventos, fotos, pedidos e usuários
          associados. Esta ação não pode ser desfeita.
        </p>
        <DeleteTenantButton tenantId={tenant.id} />
      </div>
    </div>
  )
}
