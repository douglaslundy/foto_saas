import { createAdminClient } from '@/lib/supabase/admin'

export type WhatsAppConfig = {
  apiUrl: string
  apiKey: string
  instance: string
}

const SETTINGS_KEYS = ['evolution_api_url', 'evolution_api_key', 'evolution_instance'] as const

// Mesmo padrao do SMTP: variaveis de ambiente primeiro (infra-as-code), com
// fallback para configuracoes salvas via /admin/configuracoes (system_settings).
export async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  const envUrl = process.env.EVOLUTION_API_URL ?? ''
  const envKey = process.env.EVOLUTION_API_KEY ?? ''
  const envInstance = process.env.EVOLUTION_INSTANCE ?? ''
  if (envUrl && envKey && envInstance) {
    return { apiUrl: envUrl.replace(/\/+$/, ''), apiKey: envKey, instance: envInstance }
  }

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (adminClient as any)
    .from('system_settings')
    .select('key, value')
    .in('key', SETTINGS_KEYS) as { data: { key: string; value: string | null }[] | null }

  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    map[row.key] = row.value ?? ''
  }

  if (!map.evolution_api_url || !map.evolution_api_key || !map.evolution_instance) return null

  return {
    apiUrl: map.evolution_api_url.replace(/\/+$/, ''),
    apiKey: map.evolution_api_key,
    instance: map.evolution_instance,
  }
}
