import { createAdminClient } from '@/lib/supabase/admin'

export type SmtpConfig = {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'] as const

// Le a configuracao SMTP do .env primeiro (deploys que preferem infra-as-code);
// se nao houver host la, cai para as configuracoes salvas via UI do admin
// (system_settings), que sao editaveis sem precisar de redeploy.
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const envHost = process.env.SMTP_HOST ?? ''
  if (envHost) {
    return {
      host: envHost,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
      from: process.env.SMTP_FROM || 'noreply@fotosaas.com',
    }
  }

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (adminClient as any)
    .from('system_settings')
    .select('key, value')
    .in('key', SMTP_KEYS) as { data: { key: string; value: string | null }[] | null }

  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    map[row.key] = row.value ?? ''
  }

  if (!map.smtp_host) return null

  return {
    host: map.smtp_host,
    port: parseInt(map.smtp_port || '587', 10),
    user: map.smtp_user ?? '',
    pass: map.smtp_pass ?? '',
    from: map.smtp_from || 'noreply@fotosaas.com',
  }
}
