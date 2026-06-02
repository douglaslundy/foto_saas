import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PerfilStudioForm } from './_components/perfil-studio-form'

async function getTenantProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants')
    .select('name, slug, custom_domain, primary_color, bio, logo_storage_path')
    .eq('id', profile.tenant_id)
    .single()

  if (!tenant) redirect('/login')

  return tenant as {
    name: string
    slug: string
    custom_domain: string | null
    primary_color: string | null
    bio: string | null
    logo_storage_path: string | null
  }
}

export default async function PerfilStudioPage() {
  const tenant = await getTenantProfile()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">Perfil do Estúdio</h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">Informações do seu estúdio fotográfico</p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar nav */}
        <div
          className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden h-fit"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          {[
            { href: '/dashboard/configuracoes', label: '👤 Dados da Conta', active: false },
            { href: '/dashboard/configuracoes/perfil-studio', label: '🏢 Perfil do Estúdio', active: true },
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

        {/* Form card */}
        <PerfilStudioForm initial={tenant} />
      </div>
    </div>
  )
}
