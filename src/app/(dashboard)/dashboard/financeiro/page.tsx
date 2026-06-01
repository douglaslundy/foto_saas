import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { FinanceiroClient } from './_components/financeiro-client'

type OrderRow = {
  id: string
  total_cents: number
  client_email: string
  payment_method: string
  created_at: string
  status: string
  order_items: { events: { tenant_id: string } | null }[]
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
  return profile as { tenant_id: string; role: string }
}

export default async function FinanceiroPage() {
  const profile = await getProfile()
  const adminClient = createAdminClient()

  // Fetch all paid orders with tenant info via joins
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders } = (await (adminClient as any)
    .from('orders')
    .select(
      `id, total_cents, client_email, payment_method, created_at, status,
       order_items(event_id, events(tenant_id))`
    )
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(200)) as { data: OrderRow[] | null }

  // Filter to this tenant only
  const tenantOrders = (orders ?? []).filter((o) =>
    o.order_items?.some((oi) => oi.events?.tenant_id === profile.tenant_id)
  )

  return <FinanceiroClient orders={tenantOrders} />
}
