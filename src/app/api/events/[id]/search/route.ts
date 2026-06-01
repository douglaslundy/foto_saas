import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event } = (await (adminClient as any)
    .from('events')
    .select('id, tenant_id, status, facial_recognition_enabled')
    .eq('id', id)
    .single()) as {
    data: { id: string; tenant_id: string; status: string; facial_recognition_enabled: boolean } | null
  }

  if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
  if (event.status !== 'published') {
    return NextResponse.json({ error: 'Evento não publicado.' }, { status: 403 })
  }
  if (!event.facial_recognition_enabled) {
    return NextResponse.json({ error: 'Reconhecimento facial não habilitado neste evento.' }, { status: 400 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const selfie = formData.get('selfie') as File | null
  if (!selfie) {
    return NextResponse.json({ error: 'Campo selfie obrigatório.' }, { status: 400 })
  }

  // Proxy to face-service — selfie bytes are forwarded and NOT stored (LGPD)
  const proxyForm = new FormData()
  proxyForm.append('event_id', event.id)
  proxyForm.append('tenant_id', event.tenant_id)
  proxyForm.append('selfie', selfie)

  const faceServiceUrl = process.env.FACE_RECOGNITION_SERVICE_URL ?? 'http://localhost:8000'

  let faceResponse: Response
  try {
    faceResponse = await fetch(`${faceServiceUrl}/search`, {
      method: 'POST',
      body: proxyForm,
    })
  } catch {
    return NextResponse.json(
      { error: 'Serviço de reconhecimento facial indisponível.' },
      { status: 502 }
    )
  }

  if (!faceResponse.ok) {
    const faceData = await faceResponse.json().catch(() => ({})) as { detail?: string }
    if (faceResponse.status === 422) {
      return NextResponse.json(
        { error: faceData.detail ?? 'Nenhuma face detectada na selfie.' },
        { status: 422 }
      )
    }
    return NextResponse.json({ error: 'Erro no serviço de reconhecimento facial.' }, { status: 502 })
  }

  const faceData = await faceResponse.json() as {
    matches?: Array<{ photo_id: string; face_index: number; score: number }>
  }
  // Deduplicate: a photo with multiple faces may appear more than once
  const photo_ids = [...new Set((faceData.matches ?? []).map((m) => m.photo_id))]
  return NextResponse.json({ photo_ids, count: photo_ids.length })
}
