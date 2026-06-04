import { createAdminClient } from '@/lib/supabase/admin'

function isConfiguredToken(token: string): boolean {
  if (!token) return false
  if (token.includes('placeholder')) return false
  return token.startsWith('APP_USR-') || token.startsWith('TEST-')
}

export async function getMercadoPagoAccessToken(): Promise<string | null> {
  const envToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? ''
  if (isConfiguredToken(envToken)) return envToken

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (adminClient as any)
    .from('system_settings')
    .select('value')
    .eq('key', 'mercadopago_access_token')
    .maybeSingle() as { data: { value: string | null } | null }

  const storedToken = data?.value?.trim() ?? ''
  return isConfiguredToken(storedToken) ? storedToken : null
}
