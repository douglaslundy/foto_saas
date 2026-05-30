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
    { href: '/admin',               label: 'Visão Geral' },
    { href: '/admin/tenants',       label: 'Fotógrafos' },
    { href: '/admin/configuracoes', label: 'Configurações' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-lg text-destructive">FotoSaaS Admin</span>
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {link.label}
          </Link>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Ir para Dashboard
          </Link>
          <span className="text-sm text-muted-foreground">
            {profile?.name ?? user.email}
          </span>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
