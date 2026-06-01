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
      <div className="border-t pt-4 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Configurações do Estúdio</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="/dashboard/configuracoes/perfil-studio"
            className="border rounded-lg p-4 hover:border-primary hover:shadow-sm transition-all space-y-1 block"
          >
            <h3 className="font-medium">Perfil do Estúdio</h3>
            <p className="text-sm text-muted-foreground">Nome, bio, cor e domínio personalizado.</p>
          </a>
          <a
            href="/dashboard/configuracoes/watermark"
            className="border rounded-lg p-4 hover:border-primary hover:shadow-sm transition-all space-y-1 block"
          >
            <h3 className="font-medium">Marca d&apos;água</h3>
            <p className="text-sm text-muted-foreground">Configure a marca d&apos;água aplicada nas fotos.</p>
          </a>
        </div>
      </div>
    </div>
  )
}
