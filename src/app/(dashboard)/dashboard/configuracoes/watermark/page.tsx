import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import WatermarkForm from './_components/watermark-form'

export const metadata = { title: "Marca d'água" }

export default async function WatermarkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: config } = await (admin as any)
    .from('watermark_configs')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">Marca d&apos;água</h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">Configure sua marca d&apos;água nas fotos</p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar nav */}
        <div
          className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden h-fit"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          {[
            { href: '/dashboard/configuracoes', label: '👤 Dados da Conta', active: false },
            { href: '/dashboard/configuracoes/perfil-studio', label: '🏢 Perfil do Estúdio', active: false },
            { href: '/dashboard/configuracoes/watermark', label: "💧 Marca d'água", active: true },
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

        {/* Card */}
        <WatermarkForm tenantId={profile.tenant_id} initial={config} />
      </div>
    </div>
  )
}
