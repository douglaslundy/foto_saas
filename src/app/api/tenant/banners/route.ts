import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile?.tenant_id) return null
  return profile as { tenant_id: string; role: string }
}

const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

export async function GET() {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: banners } = await (admin as any)
    .from('banner_images')
    .select('id, storage_path, title, subtitle, sort_order, active')
    .eq('tenant_id', profile.tenant_id)
    .order('sort_order', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants')
    .select('banner_mode')
    .eq('id', profile.tenant_id)
    .single()

  const items = (banners ?? []).map((b: { id: string; storage_path: string; title: string | null; subtitle: string | null; sort_order: number; active: boolean }) => ({
    ...b,
    url: `${STORAGE_URL}/${b.storage_path}`,
  }))

  return NextResponse.json({ banners: items, banner_mode: tenant?.banner_mode ?? 'static' })
}

export async function POST(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('image')
  const title = formData.get('title') as string | null
  const subtitle = formData.get('subtitle') as string | null

  if (!file || !(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Imagem obrigatória.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (admin as any)
    .from('banner_images')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)

  const sortOrder = (count ?? 0) as number
  const ext = file.type.includes('png') ? 'png' : 'jpg'
  const storagePath = `banners/${profile.tenant_id}/carousel_${Date.now()}.${ext}`

  const buffer = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage
    .from('photos-public')
    .upload(storagePath, buffer, { contentType: file.type || 'image/jpeg', upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: banner, error } = await (admin as any)
    .from('banner_images')
    .insert({ tenant_id: profile.tenant_id, storage_path: storagePath, title, subtitle, sort_order: sortOrder })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ banner }, { status: 201 })
}
