import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SiteForm from './_components/site-form'
import { BannerManager } from './_components/banner-manager'

export const metadata = { title: 'Configurações do Site' }

const NAV_ITEMS = [
  { href: '/dashboard/configuracoes', label: '👤 Dados da Conta', active: false },
  { href: '/dashboard/configuracoes/perfil-studio', label: '🏢 Perfil do Estúdio', active: false },
  { href: '/dashboard/configuracoes/watermark', label: "💧 Marca d'água", active: false },
  { href: '/dashboard/configuracoes/site', label: '🌐 Site / Banner', active: true },
  { href: '/dashboard/configuracoes/pacotes', label: '📦 Pacotes', active: false },
]

export default async function SitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()
  if (!profile?.tenant_id) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants')
    .select('banner_image_path, banner_title, banner_subtitle, banner_cta_text, banner_cta_url, banner_mode')
    .eq('id', profile.tenant_id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">Site / Banner</h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">Configure o banner da página pública do seu estúdio</p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar nav */}
        <div
          className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] overflow-hidden h-fit"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          {NAV_ITEMS.map(item => (
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

        {/* Form cards */}
        <div className="space-y-6">
          <BannerManager initialMode={(tenant?.banner_mode ?? 'static') as 'static' | 'carousel'} />
          <SiteForm
            tenantId={profile.tenant_id}
            initial={{
              banner_image_path: tenant?.banner_image_path ?? null,
              banner_title: tenant?.banner_title ?? '',
              banner_subtitle: tenant?.banner_subtitle ?? '',
              banner_cta_text: tenant?.banner_cta_text ?? '',
              banner_cta_url: tenant?.banner_cta_url ?? '',
            }}
          />
        </div>
      </div>
    </div>
  )
}
