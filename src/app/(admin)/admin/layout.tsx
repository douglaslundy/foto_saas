import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('role, name')
    .eq('id', user.id)
    .single() as { data: { role: string; name: string | null } | null }

  if (profile?.role !== 'admin') redirect('/dashboard')

  const navLinks = [
    { href: '/admin', label: 'Dashboard', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    )},
    { href: '/admin/tenants', label: 'Tenants', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 14V6l6-4 6 4v8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <rect x="5.5" y="9" width="2" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="8.5" y="9" width="2" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    )},
    { href: '/admin/configuracoes', label: 'Configurações', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )},
  ]

  return (
    <div className="min-h-screen flex bg-[var(--color-surface)]">
      {/* Sidebar */}
      <aside
        className="w-60 shrink-0 border-r border-[var(--color-border-strong)] bg-[var(--color-card)] flex flex-col"
        style={{ minHeight: '100vh' }}
      >
        {/* Logo */}
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[var(--color-cta)] text-[var(--color-cta-fg)] flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M1.5 12c0-2.761 2.239-4.5 5.5-4.5s5.5 1.739 5.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-bold text-sm text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>FotoSaaS</span>
            <span className="ml-auto text-[9px] font-bold uppercase tracking-widest bg-[var(--color-danger)]/10 text-[var(--color-danger)] px-1.5 py-0.5 rounded">
              Admin
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-muted)] mb-1">
            Principal
          </p>
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)] transition-colors"
            >
              <span className="text-[var(--color-ink-muted)]">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Bottom user section */}
        <div className="p-3 border-t border-[var(--color-border)]">
          <div className="px-3 py-2.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)]">
            <p className="text-xs font-medium text-[var(--color-ink)] truncate">
              {profile?.name ?? user.email}
            </p>
            <Link
              href="/dashboard"
              className="text-[10px] text-[var(--color-ink-muted)] hover:text-[var(--color-gold)] transition-colors mt-0.5 block"
            >
              Ir para Dashboard →
            </Link>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 min-w-0">
        {children}
      </main>
    </div>
  )
}
