import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getDashboardFallbackPath } from '@/lib/dashboard-access'
import { InviteForm } from './_components/invite-form'
import { MemberList } from './_components/member-list'

type Member = {
  id: string
  email: string
  role: string
  created_at: string
  can_create_events: boolean
  internal_commission_percent: number | null
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

  if (!profile?.tenant_id) redirect(getDashboardFallbackPath(profile as { role?: string | null; tenant_id?: string | null } | null))
  return { profile: profile as { id: string; tenant_id: string; role: string } }
}


export default async function EquipePage() {
  const { profile } = await getProfile()
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = (await (adminClient as any)
    .from('users')
    .select('id, email, role, created_at, can_create_events, internal_commission_percent')
    .eq('tenant_id', profile.tenant_id)
    .in('role', ['photographer', 'sub_photographer', 'admin'])
    .order('created_at', { ascending: true })) as { data: Member[] | null }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            Equipe
          </h1>
          <p className="text-[var(--color-ink-muted)] text-sm mt-1">
            Membros do seu estúdio
          </p>
        </div>
      </div>

      {/* Member list with edit/remove */}
      <MemberList
        members={members ?? []}
        canManage={['photographer', 'admin'].includes(profile.role)}
        currentUserId={profile.id}
      />

      {/* Invite form — only visible to main photographer */}
      {profile.role === 'photographer' && (
        <div
          className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-6 space-y-3"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <div>
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
              Convidar colaborador
            </h2>
            <p className="text-sm text-[var(--color-ink-muted)] mt-1">
              O colaborador receberá um e-mail para criar sua conta e terá acesso como sub-fotógrafo.
            </p>
          </div>
          <InviteForm />
        </div>
      )}
    </div>
  )
}
