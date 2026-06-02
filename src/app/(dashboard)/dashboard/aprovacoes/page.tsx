import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ApprovalQueue } from './_components/approval-queue'

type PendingEvent = {
  id: string
  title: string
  type: string
  event_date: string | null
  created_at: string
  creator_email?: string | null
}

export default async function AprovacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null }

  if (!profile || profile.role !== 'photographer') redirect('/dashboard')

  // Buscar eventos pendentes — sem join complexo; buscar separadamente se necessário
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pending } = await (admin as any)
    .from('events')
    .select('id, title, type, event_date, created_at')
    .eq('tenant_id', profile.tenant_id)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          Aprovações Pendentes
        </h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">
          Eventos criados por sua equipe aguardando aprovação.
        </p>
      </div>
      <ApprovalQueue events={(pending ?? []) as PendingEvent[]} />
    </div>
  )
}
