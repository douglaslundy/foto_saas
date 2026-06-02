import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Props = { params: Promise<{ id: string }> }

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: p } = await (admin as any)
    .from('users').select('tenant_id').eq('id', user.id).single()
  return p as { tenant_id: string } | null
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await request.json() as { active?: boolean; sort_order?: number }
  const updates: Record<string, unknown> = {}
  if (typeof body.active === 'boolean') updates.active = body.active
  if (typeof body.sort_order === 'number') updates.sort_order = body.sort_order

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('banner_images')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: banner } = await (admin as any)
    .from('banner_images')
    .select('storage_path')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (banner?.storage_path) {
    await admin.storage.from('photos-public').remove([banner.storage_path])
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('banner_images')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)

  return NextResponse.json({ ok: true })
}
