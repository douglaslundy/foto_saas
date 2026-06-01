import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from './_components/settings-form'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single() as { data: { name: string | null; role: string } | null }

  const roleLabel =
    profile?.role === 'admin'
      ? 'Administrador da Plataforma'
      : profile?.role === 'photographer'
      ? 'Fotógrafo'
      : profile?.role === 'sub_photographer'
      ? 'Sub-fotógrafo'
      : profile?.role ?? '—'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">Configurações</h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">Gerencie sua conta e preferências</p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar nav */}
        <div
          className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden h-fit"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          {[
            { href: '/dashboard/configuracoes', label: '👤 Dados da Conta', active: true },
            { href: '/dashboard/configuracoes/perfil-studio', label: '🏢 Perfil do Estúdio', active: false },
            { href: '/dashboard/configuracoes/watermark', label: "💧 Marca d'água", active: false },
            { href: '/dashboard/configuracoes/site', label: '🌐 Site / Banner', active: false },
            { href: '/dashboard/configuracoes/pacotes', label: '📦 Pacotes', active: false },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium border-b border-[var(--color-border)] last:border-0 transition-colors ${
                item.active
                  ? 'bg-[var(--color-surface-alt)] text-[var(--color-ink)] font-semibold'
                  : 'hover:bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)]'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Role badge */}
          <div
            className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-5 py-3 flex items-center gap-2"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-soft)]">Papel no sistema:</span>
            <span className="text-sm font-semibold text-[var(--color-ink)]">{roleLabel}</span>
          </div>

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
