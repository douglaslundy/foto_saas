import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { TenantsTable } from './_components/tenants-table'

type Tenant = {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
}

export default async function TenantsPage() {
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenants } = (await (adminClient as any)
    .from('tenants')
    .select('id, name, slug, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500)) as { data: Tenant[] | null }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fotógrafos ({tenants?.length ?? 0})</h1>
        <Link
          href="/admin/tenants/novo"
          className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          + Novo Fotógrafo
        </Link>
      </div>

      <TenantsTable tenants={tenants ?? []} />
    </div>
  )
}
