import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { grantEssayAccess } from '@/lib/essay-access'

type Props = { params: Promise<{ id: string }> }

// POST /api/essay-reviews/[id]/verify-password — acesso ao ensaio sem conta,
// apenas com a senha definida pelo fotografo. Publico (o proprio reviewId ja
// funciona como identificador secreto, igual ao restante do fluxo de ensaio).
export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params

  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const password = (body.password ?? '').trim()
  if (!password) {
    return NextResponse.json({ error: 'Informe a senha.' }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, access_password')
    .eq('id', id)
    .single() as { data: { id: string; access_password: string | null } | null }

  if (!review) return NextResponse.json({ error: 'Ensaio não encontrado.' }, { status: 404 })
  if (!review.access_password) {
    return NextResponse.json({ error: 'Este ensaio não tem senha de acesso configurada.' }, { status: 400 })
  }
  if (password !== review.access_password) {
    return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 })
  }

  await grantEssayAccess(id)

  return NextResponse.json({ ok: true })
}
