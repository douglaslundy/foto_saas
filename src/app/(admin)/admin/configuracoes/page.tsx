import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AdminSettingsForm } from './_components/admin-settings-form'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null }

  if (profile?.role !== 'admin') redirect('/dashboard')

  // Fetch all system settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (adminClient as any)
    .from('system_settings')
    .select('key, value') as { data: { key: string; value: string | null }[] | null }

  const settingsMap: Record<string, string> = {}
  for (const row of rows ?? []) {
    settingsMap[row.key] = row.value ?? ''
  }

  const initialSettings = {
    global_commission_percent: settingsMap['global_commission_percent'] ?? '10',
    stripe_secret_key: settingsMap['stripe_secret_key'] ?? '',
    stripe_publishable_key: settingsMap['stripe_publishable_key'] ?? '',
    mercadopago_access_token: settingsMap['mercadopago_access_token'] ?? '',
    auto_approve_sub_events: settingsMap['auto_approve_sub_events'] ?? 'false',
    platform_name: settingsMap['platform_name'] ?? '',
    platform_favicon_url: settingsMap['platform_favicon_url'] ?? '',
    photo_compression_enabled: settingsMap['photo_compression_enabled'] ?? 'true',
    smtp_host: settingsMap['smtp_host'] ?? '',
    smtp_port: settingsMap['smtp_port'] ?? '587',
    smtp_user: settingsMap['smtp_user'] ?? '',
    smtp_pass: settingsMap['smtp_pass'] ?? '',
    smtp_from: settingsMap['smtp_from'] ?? '',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-3xl font-bold tracking-tight text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Configurações
        </h1>
        <p className="text-[var(--color-ink-muted)] text-sm mt-1">
          Gerencie comissões globais, credenciais de pagamento e envio de e-mail da plataforma.
        </p>
      </div>

      <AdminSettingsForm initialSettings={initialSettings} />
    </div>
  )
}
