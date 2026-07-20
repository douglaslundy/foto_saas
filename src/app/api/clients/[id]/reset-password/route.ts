import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPasswordReset } from '@/lib/notifications/email'
import { sendWhatsAppMessage } from '@/lib/notifications/whatsapp'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return { adminClient }
}

// POST /api/clients/[id]/reset-password — o admin gera uma nova senha
// temporária para o cliente e envia por e-mail (e WhatsApp, se cadastrado).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client } = await (auth.adminClient as any)
    .from('users')
    .select('id, name, email, phone, role')
    .eq('id', id)
    .single()

  if (!client || (client.role !== 'client' && client.role !== 'client_inactive')) {
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow } = await (auth.adminClient as any)
    .from('users')
    .select('tenant_id')
    .eq('id', id)
    .single() as { data: { tenant_id: string | null } | null }

  let tenantSlug = ''
  let studioName: string | undefined
  if (tenantRow?.tenant_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tenant } = await (auth.adminClient as any)
      .from('tenants')
      .select('slug, name')
      .eq('id', tenantRow.tenant_id)
      .single() as { data: { slug: string; name: string } | null }
    tenantSlug = tenant?.slug ?? ''
    studioName = tenant?.name
  }

  const tempPassword = Math.random().toString(36).slice(-8) + 'A1!'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: authError } = await (auth.adminClient as any).auth.admin.updateUserById(id, {
    password: tempPassword,
  })

  if (authError) {
    console.error('[POST /api/clients/[id]/reset-password]', authError)
    return NextResponse.json({ error: 'Erro ao redefinir senha.' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const loginUrl = `${appUrl}/${tenantSlug}/login`

  await sendPasswordReset({
    to: client.email,
    name: client.name ?? undefined,
    tempPassword,
    loginUrl,
    studioName,
  })

  if (client.phone) {
    await sendWhatsAppMessage(
      client.phone,
      `Olá${client.name ? `, ${client.name}` : ''}! 🔑\n\nSua senha de acesso ao portal de fotos foi redefinida.\n\nE-mail: ${client.email}\nNova senha temporária: ${tempPassword}\n\nAcesse: ${loginUrl}`
    )
  }

  return NextResponse.json({ ok: true })
}
