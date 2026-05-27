import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const navLinks = [
  { href: '/dashboard', label: 'Início' },
  { href: '/dashboard/eventos', label: 'Eventos' },
  { href: '/dashboard/financeiro', label: 'Financeiro' },
  { href: '/dashboard/clientes', label: 'Clientes' },
  { href: '/dashboard/equipe', label: 'Equipe' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, name, tenant_id')
    .eq('id', user.id)
    .single()

  // @ts-expect-error: profile type is not properly inferred from placeholder Database type
  if (!profile || !['photographer', 'sub_photographer'].includes(profile.role)) {
    redirect('/login')
  }

  const profileWithName = profile as { name?: string } | null
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg">FotoSaaS</span>
          <div className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <span className="text-sm text-muted-foreground">{profileWithName?.name}</span>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
