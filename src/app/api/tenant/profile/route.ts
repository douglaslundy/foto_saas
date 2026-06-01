import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.tenant_id) return null
  return profile as { tenant_id: string; role: string }
}

export async function GET() {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant, error } = await (admin as any)
    .from('tenants')
    .select('name, slug, custom_domain, primary_color, bio')
    .eq('id', profile.tenant_id)
    .single()

  if (error || !tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  return NextResponse.json(tenant)
}

export async function PATCH(request: Request) {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, custom_domain, primary_color, bio } = body as {
    name?: string
    custom_domain?: string | null
    primary_color?: string | null
    bio?: string | null
  }

  // Build update payload with only allowed fields
  const updates: Record<string, unknown> = {}
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }
    updates.name = name.trim()
  }
  if (custom_domain !== undefined) updates.custom_domain = custom_domain || null
  if (primary_color !== undefined) updates.primary_color = primary_color || null
  if (bio !== undefined) updates.bio = bio || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant, error } = await (admin as any)
    .from('tenants')
    .update(updates)
    .eq('id', profile.tenant_id)
    .select('name, slug, custom_domain, primary_color, bio')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(tenant)
}
