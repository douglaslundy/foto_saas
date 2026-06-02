import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any).from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await request.json() as { banner_mode: string }
  if (!['static', 'carousel'].includes(body.banner_mode)) {
    return NextResponse.json({ error: 'Modo inválido.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('tenants').update({ banner_mode: body.banner_mode }).eq('id', profile.tenant_id)
  return NextResponse.json({ ok: true })
}
