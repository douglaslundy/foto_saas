import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { InviteForm } from './_components/invite-form'
import { RemoveMemberButton } from './_components/remove-member-button'

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

const roleLabel: Record<string, string> = {
  photographer: 'Fotógrafo',
  sub_photographer: 'Sub-fotógrafo',
}

function roleBadgeClass(role: string): string {
  if (role === 'photographer') {
    return 'bg-[var(--color-gold-light)] text-[var(--color-gold)] border border-[var(--color-gold)]/30'
  }
  if (role === 'sub_photographer') {
    return 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)] border border-[var(--color-border-strong)]'
  }
  return 'bg-[var(--color-surface-alt)] text-[var(--color-ink-muted)] border border-[var(--color-border-strong)]'
}

function getInitials(email: string): string {
  const local = email.split('@')[0] ?? ''
  return local.slice(0, 2).toUpperCase()
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

      {/* Member grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(members ?? []).map((m) => (
          <div
            key={m.id}
            className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            {/* Avatar + info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border-strong)] flex items-center justify-center font-display text-lg font-semibold text-[var(--color-ink)] shrink-0">
                {getInitials(m.email)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{m.email}</p>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Desde {new Date(m.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {/* Role badge */}
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${roleBadgeClass(m.role)}`}
            >
              {roleLabel[m.role] ?? m.role}
            </span>

            {/* Botão remover — só para sub-fotógrafos, só o fotógrafo principal vê */}
            {profile.role === 'photographer' && m.role === 'sub_photographer' && m.id !== profile.id && (
              <RemoveMemberButton memberId={m.id} />
            )}
          </div>
        ))}

        {(!members || members.length === 0) && (
          <div className="col-span-full py-16 text-center">
            <svg
              className="mx-auto mb-4 text-[var(--color-ink-muted)]"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.3"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p className="font-display text-lg font-semibold text-[var(--color-ink)]">
              Nenhum membro ainda.
            </p>
          </div>
        )}
      </div>

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
