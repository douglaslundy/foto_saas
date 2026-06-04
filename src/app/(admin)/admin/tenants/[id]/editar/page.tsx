import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { EditTenantForm } from './_components/edit-tenant-form'

type Props = { params: Promise<{ id: string }> }

export default async function EditTenantPage({ params }: Props) {
  const { id } = await params
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (adminClient as any)
    .from('tenants')
    .select('id, name, slug, status')
    .eq('id', id)
    .single() as { data: { id: string; name: string; slug: string; status: string } | null }

  if (!tenant) notFound()

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <Link
          href="/admin/tenants"
          className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          ← Voltar para Tenants
        </Link>
        <h1
          className="text-3xl font-bold tracking-tight text-[var(--color-ink)] mt-1"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Editar Tenant
        </h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">
          Ajuste nome e slug do tenant.
        </p>
      </div>

      <EditTenantForm tenant={tenant} />
    </div>
  )
}
