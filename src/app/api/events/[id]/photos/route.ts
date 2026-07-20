import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '48', 10) || 48, 1), 200)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = (await (adminClient as any)
    .from('events')
    .select('id, tenant_id, status')
    .eq('id', id)
    .single()) as { data: { id: string; tenant_id: string; status: string } | null }

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })

  if (event.status !== 'published') {
    // Draft events require photographer auth
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = (await (adminClient as any)
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()) as { data: { tenant_id: string } | null }

    if (profile?.tenant_id !== event.tenant_id) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos, count, error } = (await (adminClient as any)
    .from('photos')
    .select('id, public_storage_path, thumbnail_path, status, updated_at', { count: 'exact' })
    .eq('event_id', id)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)) as {
    data: unknown[] | null
    count: number | null
    error: { message: string } | null
  }

  if (error) {
    console.error('[GET /api/events/[id]/photos]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return NextResponse.json({ photos: photos ?? [], total: count ?? 0 })
}
