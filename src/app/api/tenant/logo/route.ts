import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
])

const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2MB

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  return map[mimeType] ?? 'jpg'
}

export async function POST(request: NextRequest) {
  // 1. Verify authentication
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  // 2. Get user's tenant_id
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileError } = await (admin as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single() as { data: { tenant_id: string; role: string } | null; error: { message: string } | null }

  if (profileError) {
    console.error('[logo] Profile fetch error:', profileError)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const tenantId = profile.tenant_id

  // 3. Parse FormData
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
  }

  // 4. Validate MIME type
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Formato de arquivo não suportado. Use JPG, PNG, WEBP ou SVG.' },
      { status: 400 }
    )
  }

  // 5. Validate size
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'Arquivo muito grande. Tamanho máximo: 2MB.' },
      { status: 400 }
    )
  }

  // 6. Build storage path
  const ext = getExtension(file.type)
  const storagePath = `logos/${tenantId}/logo.${ext}`

  // 7. Upload to photos-public bucket
  const buffer = Buffer.from(await file.arrayBuffer())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: uploadError } = await (admin as any).storage
    .from('photos-public')
    .upload(storagePath, buffer, { upsert: true, contentType: file.type }) as { error: { message: string } | null }

  if (uploadError) {
    console.error('[logo] Storage upload error:', uploadError)
    return NextResponse.json({ error: 'Erro ao salvar logotipo.' }, { status: 500 })
  }

  // 8. Update tenants table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (admin as any)
    .from('tenants')
    .update({ logo_storage_path: storagePath })
    .eq('id', tenantId) as { error: { message: string } | null }

  if (updateError) {
    console.error('[logo] DB update error:', updateError)
    return NextResponse.json({ error: 'Erro ao atualizar logotipo no banco de dados.' }, { status: 500 })
  }

  // 9. Build public URL
  const logoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public/${storagePath}`

  return NextResponse.json({ logoUrl }, { status: 200 })
}
