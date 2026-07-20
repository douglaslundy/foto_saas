import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildZip } from '@/lib/zip'

type Params = { params: Promise<{ id: string }> }

// GET /api/essay-reviews/[id]/download-zip — o fotógrafo baixa as fotos que o
// cliente selecionou no ensaio (originais, sem perda de qualidade) para tratar.
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role').eq('id', user.id).single() as
    { data: { tenant_id: string; role: string } | null }

  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, event_id, tenant_id, selected_photo_ids, status')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single() as { data: {
      id: string; event_id: string; tenant_id: string
      selected_photo_ids: string[]; status: string
    } | null }

  if (!review) return NextResponse.json({ error: 'Seleção não encontrada.' }, { status: 404 })

  const selectedIds = review.selected_photo_ids ?? []
  if (selectedIds.length === 0) {
    return NextResponse.json({ error: 'Nenhuma foto selecionada ainda.' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos, error: photosError } = await (admin as any)
    .from('photos')
    .select('id, original_storage_path')
    .in('id', selectedIds)
    .eq('event_id', review.event_id)

  if (photosError || !photos) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }

  const files: { name: string; data: Buffer }[] = []

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i] as { id: string; original_storage_path: string | null }
    if (!photo.original_storage_path) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: downloadError } = await (admin as any).storage
      .from('photos-original')
      .download(photo.original_storage_path)

    if (downloadError || !data) {
      console.error('[essay-reviews/download-zip] storage download error:', photo.id, downloadError)
      continue
    }

    const buffer = Buffer.from(await data.arrayBuffer())
    const ext = photo.original_storage_path.split('.').pop() || 'jpg'
    files.push({ name: `foto_${String(i + 1).padStart(3, '0')}.${ext}`, data: buffer })
  }

  if (files.length === 0) {
    return NextResponse.json({ error: 'Não foi possível gerar o ZIP.' }, { status: 500 })
  }

  const zipBuffer = buildZip(files)
  const reviewSlug = id.slice(0, 8)

  // Baixar a seleção marca o início do tratamento das fotos pelo fotógrafo.
  if (review.status === 'submitted') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('essay_reviews')
      .update({ status: 'in_progress' })
      .eq('id', id)
  }

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="selecao-ensaio-${reviewSlug}.zip"`,
      'Content-Length': String(zipBuffer.length),
    },
  })
}
