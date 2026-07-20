import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWhatsAppConfig } from '@/lib/notifications/whatsapp-settings'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any).from('users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

// GET /api/admin/whatsapp/status — consulta o status de conexao da instancia
// do WhatsApp (Evolution API) configurada para a plataforma.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const config = await getWhatsAppConfig()
  if (!config) {
    return NextResponse.json({ configured: false })
  }

  try {
    const res = await fetch(`${config.apiUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(config.instance)}`, {
      headers: { apikey: config.apiKey },
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ configured: true, connected: false, error: `Evolution API respondeu ${res.status}` })
    }
    const data = await res.json() as Array<{ connectionStatus?: string; ownerJid?: string | null; profileName?: string | null }>
    const instance = data[0]
    if (!instance) {
      return NextResponse.json({ configured: true, exists: false, connected: false })
    }
    return NextResponse.json({
      configured: true,
      exists: true,
      connected: instance.connectionStatus === 'open',
      status: instance.connectionStatus,
      number: instance.ownerJid?.replace('@s.whatsapp.net', '') ?? null,
      profileName: instance.profileName ?? null,
      instance: config.instance,
    })
  } catch (err) {
    console.error('[GET /api/admin/whatsapp/status]', err)
    return NextResponse.json({ configured: true, connected: false, error: 'Erro ao conectar com a Evolution API.' })
  }
}
