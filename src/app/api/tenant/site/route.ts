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
  return { ...profile, userId: user.id } as { tenant_id: string; role: string; userId: string }
}

export async function GET() {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (admin as any)
    .from('tenants')
    .select('banner_image_path, banner_title, banner_subtitle, banner_cta_text, banner_cta_url')
    .eq('id', profile.tenant_id)
    .single()

  return NextResponse.json({ config: tenant ?? null })
}

export async function PUT(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const formData = await request.formData()
  const admin = createAdminClient()

  const updates: Record<string, string> = {}

  const bannerTitle = formData.get('banner_title')
  const bannerSubtitle = formData.get('banner_subtitle')
  const bannerCtaText = formData.get('banner_cta_text')
  const bannerCtaUrl = formData.get('banner_cta_url')

  if (typeof bannerTitle === 'string') updates.banner_title = bannerTitle
  if (typeof bannerSubtitle === 'string') updates.banner_subtitle = bannerSubtitle
  if (typeof bannerCtaText === 'string') updates.banner_cta_text = bannerCtaText
  if (typeof bannerCtaUrl === 'string') updates.banner_cta_url = bannerCtaUrl

  // Handle optional image upload
  const imageFile = formData.get('banner_image')
  if (imageFile && imageFile instanceof Blob && imageFile.size > 0) {
    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    const storagePath = `banners/${profile.tenant_id}/banner.jpg`

    const { error: uploadError } = await admin.storage
      .from('photos-public')
      .upload(storagePath, buffer, {
        contentType: imageFile.type || 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    updates.banner_image_path = storagePath
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('tenants')
    .update(updates)
    .eq('id', profile.tenant_id)
    .select('banner_image_path, banner_title, banner_subtitle, banner_cta_text, banner_cta_url')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}
