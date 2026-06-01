import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { InviteForm } from './_components/invite-form'
import { MemberList } from './_components/member-list'

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
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect('/login')
  return { profile: profile as { id: string; tenant_id: string; role: string } }
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Equipe</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie os colaboradores da sua conta.
        </p>
      </div>

      <MemberList
        members={members ?? []}
        canManage={profile.role === 'photographer'}
        currentUserId={profile.id}
      />

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
