import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SettingsForm } from '@/app/(dashboard)/dashboard/configuracoes/_components/settings-form'

export default async function AdminConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single() as { data: { name: string | null; role: string } | null }

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1
          className="text-3xl font-bold tracking-tight text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Configurações
        </h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">
          Gerencie seus dados de acesso ao painel administrativo.
        </p>
      </div>

      {/* Role badge */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-5"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-3">
          Papel no Sistema
        </p>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1L8.854 5.196L13.5 5.764L10.25 8.804L11.146 13.5L7 11.196L2.854 13.5L3.75 8.804L0.5 5.764L5.146 5.196L7 1Z" stroke="var(--color-danger)" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-danger)]">Administrador da Plataforma</p>
            <p className="text-xs text-[var(--color-ink-muted)]">Acesso total ao painel administrativo</p>
          </div>
        </div>
      </div>

      {/* Settings form card */}
      <div
        className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="px-6 py-4 border-b border-[var(--color-border-strong)] bg-[var(--color-surface-alt)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-muted)]">
            Dados Pessoais
          </p>
        </div>
        <div className="px-6 py-6">
          <SettingsForm
            userId={user.id}
            currentName={profile?.name ?? null}
            email={user.email ?? ''}
          />
        </div>
      </div>
    </div>
  )
}
