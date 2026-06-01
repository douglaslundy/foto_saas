import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return { user, adminClient }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { adminClient } = auth
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminClient as any)
    .from('system_settings')
    .select('key, value')

  if (error) {
    console.error('[GET /api/admin/settings]', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  const settings: Record<string, string> = {}
  for (const row of data ?? []) {
    settings[row.key] = row.value ?? ''
  }

  return NextResponse.json(settings)
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  let body: {
    global_commission_percent?: string
    stripe_secret_key?: string
    stripe_publishable_key?: string
    mercadopago_access_token?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const { adminClient } = auth

  const keys = [
    'global_commission_percent',
    'stripe_secret_key',
    'stripe_publishable_key',
    'mercadopago_access_token',
  ] as const

  for (const key of keys) {
    const value = body[key]
    if (value === undefined) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (adminClient as any)
      .from('system_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)

    if (error) {
      console.error(`[PUT /api/admin/settings] key=${key}`, error)
      return NextResponse.json({ error: `Erro ao salvar ${key}.` }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
