// src/app/api/tenant/favicon/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_TYPES = ['image/png', 'image/x-icon', 'image/svg+xml', 'image/jpeg']
const MAX_SIZE = 512 * 1024

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role').eq('id', user.id).single() as
    { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const contentType = request.headers.get('content-type') ?? ''

  // URL submission
  if (contentType.includes('application/json')) {
    let body: { url?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
    }

    if (!body.url?.trim()) {
      return NextResponse.json({ error: 'URL ou arquivo é obrigatório.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('tenants')
      .update({ favicon_url: body.url.trim() })
      .eq('id', profile.tenant_id)

    return NextResponse.json({ url: body.url.trim() })
  }

  // File upload
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Erro ao processar arquivo.' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 400 })

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo não permitido. Use PNG, ICO, SVG ou JPG.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    if (bytes.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 512 KB.' }, { status: 400 })
    }

    const ext = file.type === 'image/svg+xml' ? 'svg'
      : file.type === 'image/png' ? 'png'
      : file.type === 'image/jpeg' ? 'jpg'
      : 'ico'

    const path = `favicon/${profile.tenant_id}.${ext}`
    const { error: uploadError } = await admin.storage
      .from('platform-assets')
      .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('[tenant favicon upload]', uploadError)
      return NextResponse.json({ error: 'Erro ao fazer upload.' }, { status: 500 })
    }

    const { data: { publicUrl } } = admin.storage.from('platform-assets').getPublicUrl(path)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('tenants')
      .update({ favicon_url: publicUrl })
      .eq('id', profile.tenant_id)

    return NextResponse.json({ url: publicUrl })
  }

  return NextResponse.json({ error: 'URL ou arquivo é obrigatório.' }, { status: 400 })
}
