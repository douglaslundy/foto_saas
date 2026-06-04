import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { getDashboardFallbackPath } from '@/lib/dashboard-access'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, name, tenant_id')
    .eq('id', user.id)
    .single()

  // Avoid redirect loops if the authenticated account has no dashboard profile yet.
  if (!profile || !['photographer', 'sub_photographer', 'admin'].includes((profile as { role?: string | null }).role ?? '')) {
    if ((profile as { role?: string | null } | null)?.role === 'admin') {
      redirect('/admin')
    }

    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-lg border border-[#e5e7eb] bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-[#111827] mb-2">Acesso ao painel indisponível</h1>
          <p className="text-sm text-[#6b7280] mb-6">
            Sua conta está autenticada, mas o perfil do dashboard ainda não está configurado.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={getDashboardFallbackPath(profile as { role?: string | null; tenant_id?: string | null } | null)}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#2563eb] text-sm font-semibold text-white hover:bg-[#1d4ed8] transition-colors"
            >
              Continuar
            </a>
            <a
              href="/api/auth/signout"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-[#e5e7eb] text-sm font-medium text-[#374151] hover:bg-[#f9fafb] transition-colors"
            >
              Sair
            </a>
          </div>
        </div>
      </div>
    )
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
