import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileError } = (await (adminClient as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()) as { data: { tenant_id: string; role: string } | null; error: { message: string } | null }

  if (profileError) {
    console.error('[POST /api/events/[id]/publish] Profile error:', profileError)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = (await (adminClient as any)
    .from('events')
    .select('id, status, tenant_id')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()) as { data: { id: string; status: string; tenant_id: string } | null }

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
  if (event.status !== 'draft') {
    return NextResponse.json({ error: 'Evento já está publicado.' }, { status: 409 })
  }

  // Verify at least one ready photo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: readyPhotos } = (await (adminClient as any)
    .from('photos')
    .select('id')
    .eq('event_id', id)
    .eq('status', 'ready')
    .range(0, 0)) as { data: unknown[] | null }

  if (!readyPhotos || readyPhotos.length === 0) {
    return NextResponse.json(
      { error: 'Evento precisa ter ao menos uma foto processada para ser publicado.' },
      { status: 422 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = (await (adminClient as any)
    .from('events')
    .update({ status: 'published' })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select()
    .single()) as { data: unknown; error: { message: string } | null }

  if (error) {
    console.error('[POST /api/events/[id]/publish]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return NextResponse.json(updated)
}
