import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/navbar'

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
  if (!profile || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    redirect('/login')
  }

  const profileWithName = profile as { name?: string; role?: string } | null
  const userName = profileWithName?.name || user.email?.split('@')[0] || 'Usuário'
  const userRole = (profileWithName?.role || 'photographer') as 'admin' | 'photographer' | 'sub_photographer' | 'viewer'

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <Navbar userName={userName} userRole={userRole} />
      <main className="max-w-[1200px] mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  )
}
