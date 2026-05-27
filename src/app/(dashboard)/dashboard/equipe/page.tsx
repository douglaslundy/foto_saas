import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { InviteForm } from './_components/invite-form'

type Member = {
  id: string
  email: string
  role: string
  created_at: string
}

async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect('/login')
  return { profile: profile as { tenant_id: string; role: string } }
}

export default async function EquipePage() {
  const { profile } = await getProfile()
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = (await (adminClient as any)
    .from('users')
    .select('id, email, role, created_at')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: true })) as { data: Member[] | null }

  const roleLabel: Record<string, string> = {
    photographer: 'Fotógrafo Principal',
    sub_photographer: 'Sub-fotógrafo',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Equipe</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie os colaboradores da sua conta.
        </p>
      </div>

      {/* Member list */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-medium">Membros ({members?.length ?? 0})</h2>
        </div>
        <div className="divide-y">
          {(members ?? []).map((m) => (
            <div key={m.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{m.email}</p>
                <p className="text-xs text-muted-foreground">
                  Desde {new Date(m.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  m.role === 'photographer'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {roleLabel[m.role] ?? m.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Invite form — only visible to main photographer */}
      {profile.role === 'photographer' && (
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="font-medium">Convidar colaborador</h2>
          <p className="text-sm text-muted-foreground">
            O colaborador receberá um e-mail para criar sua conta e terá acesso como sub-fotógrafo.
          </p>
          <InviteForm />
        </div>
      )}
    </div>
  )
}
