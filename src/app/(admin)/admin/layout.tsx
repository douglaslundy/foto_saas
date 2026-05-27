import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  // @ts-expect-error: profile type is not properly inferred from placeholder Database type
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-lg text-destructive">FotoSaaS Admin</span>
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          Visão Geral
        </Link>
        <Link
          href="/admin/tenants"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Fotógrafos
        </Link>
        <span className="ml-auto text-sm text-muted-foreground">{user.email}</span>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
