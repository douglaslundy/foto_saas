import { createAdminClient } from '@/lib/supabase/admin'
import { RegistrationsTable } from './_components/registrations-table'

type Registration = {
  tenant_id: string
  studio_name: string
  slug: string
  created_at: string
  photographer: { name: string; email: string } | null
  registration: { phone: string; cpf_cnpj: string; city: string } | null
}

async function getPendingRegistrations(): Promise<Registration[]> {
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenants } = await (admin as any)
    .from('tenants')
    .select('id, name, slug, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true }) as
    { data: { id: string; name: string; slug: string; created_at: string }[] | null }

  if (!tenants?.length) return []

  const ids = tenants.map((t) => t.id)

  const [{ data: photographers }, { data: regDetails }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('users').select('tenant_id, name, email').in('tenant_id', ids).eq('role', 'photographer') as
      Promise<{ data: { tenant_id: string; name: string; email: string }[] | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('tenant_registrations').select('tenant_id, phone, cpf_cnpj, city').in('tenant_id', ids) as
      Promise<{ data: { tenant_id: string; phone: string; cpf_cnpj: string; city: string }[] | null }>,
  ])

  return tenants.map((t) => ({
    tenant_id: t.id,
    studio_name: t.name,
    slug: t.slug,
    created_at: t.created_at,
    photographer: (photographers ?? []).find((p) => p.tenant_id === t.id) ?? null,
    registration: (regDetails ?? []).find((r) => r.tenant_id === t.id) ?? null,
  }))
}

export default async function CadastrosPage() {
  const registrations = await getPendingRegistrations()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-ink,#111827)]">
          Pedidos de Cadastro
        </h1>
        <p className="text-[var(--color-ink-muted,#6b7280)] text-sm mt-1">
          {registrations.length} pedido{registrations.length !== 1 ? 's' : ''} pendente{registrations.length !== 1 ? 's' : ''}
        </p>
      </div>

      {registrations.length === 0 ? (
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-10 text-center">
          <p className="text-sm text-[#6b7280]">Nenhum pedido pendente.</p>
        </div>
      ) : (
        <RegistrationsTable registrations={registrations} />
      )}
    </div>
  )
}
