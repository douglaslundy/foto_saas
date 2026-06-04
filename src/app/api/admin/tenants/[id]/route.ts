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
  return { adminClient }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { id } = await params

  let body: { name?: string; slug?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const updateData: Record<string, string> = {}
  if (typeof body.name === 'string' && body.name.trim()) updateData.name = body.name.trim()
  if (typeof body.slug === 'string' && body.slug.trim()) {
    const slug = body.slug.trim().toLowerCase()
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ error: 'Slug inválido.' }, { status: 400 })
    }
    updateData.slug = slug
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
  }

  const { adminClient } = auth
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (adminClient as any)
    .from('tenants')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('[PATCH /api/admin/tenants/[id]]', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params
    const auth = await requireAdmin()
    if (!auth) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    const { adminClient } = auth

    // 1. Fetch all users belonging to this tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: users } = await (adminClient as any)
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)

    // 2. Delete each GoTrue user
    for (const u of users ?? []) {
      await adminClient.auth.admin.deleteUser(u.id)
    }

    // 3. Delete the tenant record (CASCADE handles events, photos, orders)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (adminClient as any)
      .from('tenants')
      .delete()
      .eq('id', tenantId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
