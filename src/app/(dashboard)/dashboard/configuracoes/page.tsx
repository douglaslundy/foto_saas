import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from './_components/settings-form'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single() as { data: { name: string | null; role: string } | null }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie seus dados de acesso e perfil.
        </p>
      </div>
      <div className="text-sm text-muted-foreground border rounded px-3 py-2 inline-block">
        Papel no sistema:{' '}
        <span className="font-medium text-foreground">
          {profile?.role === 'admin'
            ? 'Administrador da Plataforma'
            : profile?.role === 'photographer'
            ? 'Fotógrafo'
            : profile?.role === 'sub_photographer'
            ? 'Sub-fotógrafo'
            : profile?.role ?? '—'}
        </span>
      </div>
      <SettingsForm
        userId={user.id}
        currentName={profile?.name ?? null}
        email={user.email ?? ''}
      />
    </div>
  )
}
