import { cookies } from 'next/headers'
import { createHmac } from 'crypto'

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 dias

function cookieName(reviewId: string): string {
  return `essay_pw_${reviewId}`
}

function computeToken(reviewId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return createHmac('sha256', secret).update(reviewId).digest('hex')
}

// Chamado pela rota de verificacao de senha, apos confirmar a senha correta,
// para conceder acesso ao ensaio sem exigir conta/magic link do cliente.
export async function grantEssayAccess(reviewId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(cookieName(reviewId), computeToken(reviewId), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: '/',
  })
}

// Usado tanto na pagina (server component) quanto na rota de submissao para
// checar se o visitante ja passou pelo portao de senha deste ensaio.
export async function hasEssayAccess(reviewId: string): Promise<boolean> {
  const cookieStore = await cookies()
  const value = cookieStore.get(cookieName(reviewId))?.value
  if (!value) return false
  return value === computeToken(reviewId)
}
