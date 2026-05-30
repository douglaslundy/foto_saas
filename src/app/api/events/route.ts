import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hash } from 'bcryptjs'

type Profile = { tenant_id: string; role: string }

async function getAuthProfile(): Promise<{ user: { id: string }; profile: Profile } | NextResponse> {
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
    console.error('[events] Profile fetch error:', profileError)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  return { user: user as { id: string }, profile }
}

export async function GET(request: NextRequest) {
  const auth = await getAuthProfile()
  if (auth instanceof NextResponse) return auth
  const { profile } = auth

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (adminClient as any)
    .from('events')
    .select(
      'id, title, slug, type, event_date, status, price_cents, facial_recognition_enabled, is_public, created_at',
      { count: 'exact' }
    )
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })

  if (type) query = query.eq('type', type)
  if (status) query = query.eq('status', status)

  const { data: events, count, error } = (await query.range(offset, offset + limit - 1)) as {
    data: unknown[] | null
    count: number | null
    error: { message: string } | null
  }

  if (error) {
    console.error('[GET /api/events]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return NextResponse.json({ events: events ?? [], total: count ?? 0 })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthProfile()
  if (auth instanceof NextResponse) return auth
  const { profile } = auth

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
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

  if (!title || !slug || !type) {
    return NextResponse.json({ error: 'Campos obrigatórios: title, slug, type.' }, { status: 400 })
  }
  if (!['event', 'session'].includes(type)) {
    return NextResponse.json({ error: 'type deve ser event ou session.' }, { status: 400 })
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: 'Slug inválido. Use apenas letras minúsculas, números e hífens.' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Check slug uniqueness within tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = (await (adminClient as any)
    .from('events')
    .select('id')
    .eq('slug', slug)
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle()) as { data: { id: string } | null }

  if (existing) {
    return NextResponse.json({ error: 'Slug já em uso neste tenant.' }, { status: 409 })
  }

  let password_hash: string | null = null
  if (password) {
    password_hash = await hash(password, 10)
  }

  const insertData: Record<string, unknown> = {
    tenant_id: profile.tenant_id,
    title,
    slug,
    type,
    status: 'draft',
    is_public: type === 'event' ? (is_public ?? true) : false,
    price_cents: price_cents ?? 0,
    facial_recognition_enabled: type === 'event' ? (facial_recognition_enabled ?? false) : false,
  }
  if (event_date) insertData.event_date = event_date
  if (description) insertData.description = description
  if (password_hash) insertData.password_hash = password_hash

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event, error } = (await (adminClient as any)
    .from('events')
    .insert(insertData)
    .select()
    .single()) as { data: unknown; error: { message: string } | null }

  if (error) {
    console.error('[POST /api/events]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  return NextResponse.json(event, { status: 201 })
}
