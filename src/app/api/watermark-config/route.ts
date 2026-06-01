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
  const { data } = await (admin as any)
    .from('watermark_configs').select('*').eq('tenant_id', profile.tenant_id).single()
  return NextResponse.json({ config: data ?? null })
}

export async function PUT(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const contentType = request.headers.get('content-type') ?? ''
  const admin = createAdminClient()

  let body: Record<string, unknown>

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    body = {}
    // Extract text fields
    const numericFields = ['opacity', 'font_size', 'image_size_percent']
    formData.forEach((value, key) => {
      if (key !== 'watermark_image' && typeof value === 'string') {
        body[key] = numericFields.includes(key) ? Number(value) : value
      }
    })

    // Handle optional image upload
    const imageFile = formData.get('watermark_image')
    if (imageFile && imageFile instanceof Blob && imageFile.size > 0) {
      const arrayBuffer = await imageFile.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)
      const storagePath = `watermarks/${profile.tenant_id}/watermark.png`

      const { error: uploadError } = await admin.storage
        .from('photos-public')
        .upload(storagePath, buffer, {
          contentType: imageFile.type || 'image/png',
          upsert: true,
        })

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
      }

      body.image_storage_path = storagePath
    }
  } else {
    body = await request.json()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('watermark_configs')
    .upsert({ ...body, tenant_id: profile.tenant_id, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}
