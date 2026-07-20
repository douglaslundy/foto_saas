import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Props = { params: Promise<{ id: string }> }

function generatePassword(): string {
  // 6 digitos numericos — facil de ditar por telefone/WhatsApp
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function getAuthedProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('users').select('tenant_id, role').eq('id', user.id).single() as
    { data: { tenant_id: string; role: string } | null }
  if (!profile?.tenant_id || !['photographer', 'sub_photographer', 'admin'].includes(profile.role)) return null
  return profile
}

// PATCH /api/essay-reviews/[id]/access-password — o fotografo define uma senha
// customizada (body.password) ou gera uma nova aleatoria (body vazio).
export async function PATCH(request: NextRequest, { params }: Props) {
  const { id } = await params
  const profile = await getAuthedProfile()
  if (!profile) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (admin as any)
    .from('essay_reviews')
    .select('id, tenant_id')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single() as { data: { id: string; tenant_id: string } | null }

  if (!review) return NextResponse.json({ error: 'Ensaio não encontrado.' }, { status: 404 })

  let body: { password?: string } = {}
  try {
    body = await request.json()
  } catch {
    // corpo vazio é válido aqui — significa "gerar senha nova"
  }

  const customPassword = body.password?.trim()
  if (customPassword && customPassword.length < 4) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 4 caracteres.' }, { status: 400 })
  }

  const newPassword = customPassword || generatePassword()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('essay_reviews')
    .update({ access_password: newPassword })
    .eq('id', id)

  if (error) {
    console.error('[PATCH /api/essay-reviews/[id]/access-password]', error)
    return NextResponse.json({ error: 'Erro ao salvar senha.' }, { status: 500 })
  }

  return NextResponse.json({ access_password: newPassword })
}
