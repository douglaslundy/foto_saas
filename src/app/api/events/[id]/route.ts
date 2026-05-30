import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hash } from 'bcryptjs'

type Params = { params: Promise<{ id: string }> }
type Profile = { tenant_id: string; role: string }

async function getAuthAndEvent(
  request: NextRequest,
  id: string
): Promise<{ profile: Profile; event: Record<string, unknown> } | NextResponse> {
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
    .single()) as { data: Profile | null; error: { message: string } | null }

  if (profileError) {
    console.error('[getAuthAndEvent] Profile fetch error:', profileError)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = (await (adminClient as any)
    .from('events')
    .select('id, title, slug, type, event_date, description, status, is_public, password_hash, price_cents, facial_recognition_enabled, tenant_id')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()) as { data: Record<string, unknown> | null }

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })

  return { profile, event }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const result = await getAuthAndEvent(request, id)
  if (result instanceof NextResponse) return result
  return NextResponse.json(result.event)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const result = await getAuthAndEvent(request, id)
  if (result instanceof NextResponse) return result
  const { profile } = result

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { title, slug, type, event_date, description, is_public, password, price_cents, facial_recognition_enabled } =
    body as {
      title?: string
      slug?: string
      type?: string
      event_date?: string
      description?: string
      is_public?: boolean
      password?: string
      price_cents?: number
      facial_recognition_enabled?: boolean
    }

  // If slug is changing, check uniqueness
  if (slug) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ error: 'Slug inválido. Use apenas letras minúsculas, números e hífens.' }, { status: 400 })
    }
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = (await (adminClient as any)
      .from('events')
      .select('id')
      .eq('slug', slug)
      .eq('tenant_id', profile.tenant_id)
      .neq('id', id)
      .maybeSingle()) as { data: { id: string } | null }
    if (existing) {
      return NextResponse.json({ error: 'Slug já em uso neste tenant.' }, { status: 409 })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (title !== undefined) updateData.title = title
  if (slug !== undefined) updateData.slug = slug
  if (type !== undefined) updateData.type = type
  if (event_date !== undefined) updateData.event_date = event_date
  if (description !== undefined) updateData.description = description
  if (is_public !== undefined) updateData.is_public = is_public
  if (price_cents !== undefined) updateData.price_cents = price_cents
  if (facial_recognition_enabled !== undefined) updateData.facial_recognition_enabled = facial_recognition_enabled
  if (password) updateData.password_hash = await hash(password, 10)

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = (await (adminClient as any)
    .from('events')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select()
    .single()) as { data: unknown; error: { message: string } | null }

  if (error) {
    console.error('[PATCH /api/events/[id]]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const result = await getAuthAndEvent(request, id)
  if (result instanceof NextResponse) return result
  const { profile, event } = result

  if (event.status === 'published') {
    return NextResponse.json({ error: 'Não é possível excluir evento publicado.' }, { status: 403 })
  }

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient as any)
    .from('events')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)

  return new NextResponse(null, { status: 204 })
}
