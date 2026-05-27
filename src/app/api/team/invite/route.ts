import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id || profile.role !== 'photographer') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { email } = body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  }

  // Check if already a member of this tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (adminClient as any)
    .from('users')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Usuário já é membro da equipe.' }, { status: 409 })
  }

  // Invite user via Supabase admin API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inviteData, error: inviteError } = await (adminClient as any).auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        tenant_id: profile.tenant_id,
        role: 'sub_photographer',
      },
    }
  )

  if (inviteError) {
    console.error('[POST /api/team/invite]', inviteError)
    return NextResponse.json({ error: 'Erro ao enviar convite.' }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Convite enviado com sucesso.',
    userId: inviteData?.user?.id,
  })
}
