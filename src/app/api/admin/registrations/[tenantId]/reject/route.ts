import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendRegistrationRejected } from '@/lib/notifications/email'

type Props = { params: Promise<{ tenantId: string }> }

export async function PATCH(request: NextRequest, { params }: Props) {
  const { tenantId } = await params

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

  let notes: string | undefined
  try {
    const body = await request.json()
    notes = body.notes?.trim() || undefined
  } catch {
    // notes is optional
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants').select('id, name, status').eq('id', tenantId).single() as
    { data: { id: string; name: string; status: string } | null }

  if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado.' }, { status: 404 })
  if (tenant.status !== 'pending') {
    return NextResponse.json({ error: 'Tenant não está pendente.' }, { status: 409 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('tenants').update({ status: 'rejected' }).eq('id', tenantId)

  if (notes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('tenant_registrations').update({ notes }).eq('tenant_id', tenantId)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photographer } = await (admin as any)
    .from('users').select('email, name').eq('tenant_id', tenantId).eq('role', 'photographer').single() as
    { data: { email: string; name: string } | null }

  if (photographer) {
    await sendRegistrationRejected({
      to: photographer.email,
      photographerName: photographer.name,
      notes,
    })
  }

  return NextResponse.json({ success: true })
}
