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

// POST /api/admin/whatsapp/qrcode — gera (ou renova) o QR Code pra conectar
// o WhatsApp do estudio na instancia da Evolution API. Cria a instancia se
// ela ainda nao existir.
export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const config = await getWhatsAppConfig()
  if (!config) {
    return NextResponse.json({ error: 'Evolution API não configurada.' }, { status: 400 })
  }

  try {
    let res = await fetch(`${config.apiUrl}/instance/connect/${encodeURIComponent(config.instance)}`, {
      headers: { apikey: config.apiKey },
      cache: 'no-store',
    })

    if (res.status === 404) {
      // Instancia nao existe ainda — cria antes de tentar conectar de novo.
      const createRes = await fetch(`${config.apiUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
        body: JSON.stringify({ instanceName: config.instance, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
      })
      if (!createRes.ok) {
        const text = await createRes.text().catch(() => '')
        return NextResponse.json({ error: `Erro ao criar instância: ${text}` }, { status: 500 })
      }
      const createData = await createRes.json() as { qrcode?: { base64?: string } }
      if (createData.qrcode?.base64) {
        return NextResponse.json({ qrcode: createData.qrcode.base64 })
      }
      // Instancia criada mas sem QR no corpo — tenta o connect de novo
      res = await fetch(`${config.apiUrl}/instance/connect/${encodeURIComponent(config.instance)}`, {
        headers: { apikey: config.apiKey },
        cache: 'no-store',
      })
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `Erro ao gerar QR Code: ${text}` }, { status: 500 })
    }

    const data = await res.json() as { base64?: string; code?: string }
    if (!data.base64) {
      return NextResponse.json({ error: 'QR Code indisponível — a instância pode já estar conectada.' }, { status: 409 })
    }

    return NextResponse.json({ qrcode: data.base64 })
  } catch (err) {
    console.error('[POST /api/admin/whatsapp/qrcode]', err)
    return NextResponse.json({ error: 'Erro de conexão com a Evolution API.' }, { status: 500 })
  }
}
