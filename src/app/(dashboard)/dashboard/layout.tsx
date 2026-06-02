import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  // @ts-expect-error: profile type
  if (!profile || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    redirect('/login')
  }

  const profileWithName = profile as { name?: string; role?: string; tenant_id?: string } | null
  const userName = profileWithName?.name || user.email?.split('@')[0] || 'Usuário'
  const userRole = (profileWithName?.role || 'photographer') as 'admin' | 'photographer' | 'sub_photographer' | 'viewer'

  const adminClient = createAdminClient()
  const pendingCount = userRole === 'photographer'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (((await (adminClient as any)
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', profileWithName?.tenant_id ?? '')
        .eq('status', 'pending_approval')).count) ?? 0)
    : 0

  // Block pending/rejected photographers from accessing dashboard
  if (profileWithName?.role === 'photographer' && profileWithName?.tenant_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tenant } = await (adminClient as any)
      .from('tenants')
      .select('status')
      .eq('id', profileWithName.tenant_id)
      .single() as { data: { status: string } | null }

    if (tenant?.status === 'pending') redirect('/conta-em-analise')
    if (tenant?.status === 'rejected') redirect('/conta-rejeitada')
  }

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <Navbar userName={userName} userRole={userRole} pendingCount={pendingCount} />
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
