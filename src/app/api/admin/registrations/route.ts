import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('role').eq('id', user.id).single() as
    { data: { role: string } | null }

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenants, error } = await (admin as any)
    .from('tenants')
    .select('id, name, slug, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true }) as
    { data: { id: string; name: string; slug: string; created_at: string }[] | null; error: unknown }

  if (error) return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  if (!tenants?.length) return NextResponse.json({ registrations: [] })

  const tenantIds = tenants.map((t) => t.id)

  const [{ data: photographers }, { data: regDetails }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('users').select('tenant_id, name, email').in('tenant_id', tenantIds).eq('role', 'photographer') as
      Promise<{ data: { tenant_id: string; name: string; email: string }[] | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('tenant_registrations').select('tenant_id, phone, cpf_cnpj, city').in('tenant_id', tenantIds) as
      Promise<{ data: { tenant_id: string; phone: string; cpf_cnpj: string; city: string }[] | null }>,
  ])

  const result = tenants.map((t) => ({
    tenant_id: t.id,
    studio_name: t.name,
    slug: t.slug,
    created_at: t.created_at,
    photographer: (photographers ?? []).find((p) => p.tenant_id === t.id) ?? null,
    registration: (regDetails ?? []).find((r) => r.tenant_id === t.id) ?? null,
  }))

  return NextResponse.json({ registrations: result })
}
