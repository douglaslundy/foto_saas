import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/tenants', label: 'Fotógrafos' },
    { href: '/admin/repasses', label: 'Repasses' },
    { href: '/admin/configuracoes', label: 'Configurações' },
  ]

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      {/* Header escuro — diferencia admin do dashboard */}
      <header className="sticky top-0 z-50 h-14 bg-[#111827] border-b border-[#1f2937] flex items-center px-6 gap-6">
        <Link href="/admin" className="flex items-center gap-2 shrink-0 mr-2">
          <div className="w-6 h-6 rounded bg-[#2563eb] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5"/>
              <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-semibold text-sm text-white">FotoSaaS</span>
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white">
            Admin
          </span>
        </Link>

        <nav className="flex items-center gap-1 flex-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-white/60">{profile?.name ?? user.email}</span>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            Dashboard →
          </Link>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
