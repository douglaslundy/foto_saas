import { getWhatsAppConfig } from './whatsapp-settings'

// Normaliza para o formato exigido pela Evolution API: DDI+DDD+numero, so digitos.
// Assume Brasil (55) quando o numero nao vem com codigo de pais.
function normalizeBrazilianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length >= 10) return `55${digits}`
  return null
}

// Envia uma mensagem de texto via WhatsApp (Evolution API). Segue o mesmo
// contrato "nunca lança" dos envios de e-mail — falha de WhatsApp não pode
// derrubar o fluxo que a chamou (ex: envio de link de ensaio).
export async function sendWhatsAppMessage(phone: string, text: string): Promise<void> {
  const number = normalizeBrazilianPhone(phone)
  if (!number) {
    console.warn('[whatsapp] telefone inválido ou ausente, pulando envio:', phone)
    return
  }

  const config = await getWhatsAppConfig()
  if (!config) {
    console.warn('[whatsapp] Evolution API não configurada — pulando envio')
    return
  }

  try {
    const res = await fetch(`${config.apiUrl}/message/sendText/${config.instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.apiKey,
      },
      body: JSON.stringify({ number, text }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[whatsapp] envio falhou:', res.status, body)
    }
  } catch (err) {
    console.error('[whatsapp] erro de conexão:', err)
  }
}
