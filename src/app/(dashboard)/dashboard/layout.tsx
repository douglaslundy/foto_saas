import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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
        <span className="font-bold text-lg">FotoSaaS</span>
        <span className="text-sm text-muted-foreground">{profileWithName?.name}</span>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
