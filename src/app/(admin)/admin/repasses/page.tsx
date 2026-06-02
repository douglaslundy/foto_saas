import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PayoutsTable } from './_components/payouts-table'

type Payout = {
  id: string
  amount_cents: number
  status: string
  period_start: string
  period_end: string
  note: string | null
  paid_at: string | null
  created_at: string
  tenants: { id: string; name: string; slug: string } | null
}

export default async function RepassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any).from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [payoutsResult, tenantsResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('payouts')
      .select('id, amount_cents, status, period_start, period_end, note, paid_at, created_at, tenants(id, name, slug)')
      .order('created_at', { ascending: false })
      .limit(100),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('tenants')
      .select('id, name, slug')
      .eq('status', 'active')
      .order('name'),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-3xl font-bold tracking-tight text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Repasses
        </h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">
          Gerencie os repasses de receita aos fotógrafos.
        </p>
      </div>
      <PayoutsTable
        payouts={(payoutsResult.data ?? []) as Payout[]}
        tenants={(tenantsResult.data ?? []) as { id: string; name: string; slug: string }[]}
      />
    </div>
  )
}
