import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SettingsForm } from '@/app/(dashboard)/dashboard/configuracoes/_components/settings-form'

export default async function AdminConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single() as { data: { name: string | null; role: string } | null }

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie seus dados de acesso ao painel administrativo.
        </p>
      </div>
      <div className="text-sm text-muted-foreground border rounded px-3 py-2 inline-block">
        Papel no sistema:{' '}
        <span className="font-medium text-destructive">Administrador da Plataforma</span>
      </div>
      <SettingsForm
        userId={user.id}
        currentName={profile?.name ?? null}
        email={user.email ?? ''}
      />
    </div>
  )
}
