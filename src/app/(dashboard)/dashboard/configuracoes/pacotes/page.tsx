import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import PackagesManager from './_components/packages-manager'

export const metadata = { title: 'Pacotes' }

const NAV_ITEMS = [
  { href: '/dashboard/configuracoes', label: '👤 Dados da Conta', active: false },
  { href: '/dashboard/configuracoes/perfil-studio', label: '🏢 Perfil do Estúdio', active: false },
  { href: '/dashboard/configuracoes/watermark', label: "💧 Marca d'água", active: false },
  { href: '/dashboard/configuracoes/site', label: '🌐 Site / Banner', active: false },
  { href: '/dashboard/configuracoes/pacotes', label: '📦 Pacotes', active: true },
]

interface PhotoPackage {
  id: string
  tenant_id: string
  name: string
  min_quantity: number
  discount_percent: number
  active: boolean
  created_at: string
}

export default async function PacotesPage() {
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
  const { data: packages } = await (admin as any)
    .from('photo_packages')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('min_quantity', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">Pacotes</h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">Configure pacotes de desconto por quantidade de fotos</p>
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

        {/* Packages manager */}
        <PackagesManager initialPackages={(packages ?? []) as PhotoPackage[]} />
      </div>
    </div>
  )
}
