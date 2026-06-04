import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createHmac } from 'crypto'
import { getMercadoPagoAccessToken } from './mercadopago-settings'

export { getMercadoPagoAccessToken }

async function getMPConfig(): Promise<MercadoPagoConfig> {
  const accessToken = await getMercadoPagoAccessToken()
  if (!accessToken) {
    throw new Error('Mercado Pago não configurado.')
  }

  return new MercadoPagoConfig({ accessToken })
}

export async function createMercadoPagoPix({
  amountCents,
  description,
  payerEmail,
  orderId,
}: {
  amountCents: number
  description: string
  payerEmail: string
  orderId: string
}): Promise<{ pixQrCode: string; pixQrCodeBase64: string; paymentId: string }> {
  const config = await getMPConfig()
  const payment = new Payment(config)

  const result = await payment.create({
    body: {
      transaction_amount: amountCents / 100,
      description,
      payment_method_id: 'pix',
      payer: { email: payerEmail },
      external_reference: orderId,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txData = (result as any).point_of_interaction?.transaction_data
  return {
    pixQrCode: txData?.qr_code ?? '',
    pixQrCodeBase64: txData?.qr_code_base64 ?? '',
    paymentId: String(result.id),
  }
}

export async function createMercadoPagoCheckoutPreference({
  amountCents,
  description,
  payerEmail,
  orderId,
  successUrl,
}: {
  amountCents: number
  description: string
  payerEmail: string
  orderId: string
  successUrl: string
}): Promise<{ checkoutUrl: string; preferenceId: string }> {
  const accessToken = await getMercadoPagoAccessToken()
  if (!accessToken) {
    throw new Error('Mercado Pago não configurado.')
  }

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [
        {
          id: orderId,
          title: description,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: amountCents / 100,
        },
      ],
      payer: { email: payerEmail },
      external_reference: orderId,
      back_urls: {
        success: successUrl,
        pending: successUrl,
        failure: successUrl,
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/webhooks/mercadopago`,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Mercado Pago preference error: ${text}`)
  }

  const data = await res.json() as { id?: string; init_point?: string; sandbox_init_point?: string }
  const checkoutUrl = data.init_point ?? data.sandbox_init_point
  if (!checkoutUrl || !data.id) {
    throw new Error('Mercado Pago preference inválida.')
  }

  return { checkoutUrl, preferenceId: data.id }
}

export async function syncMercadoPagoOrderByExternalReference(orderId: string): Promise<'paid' | 'pending' | 'not_found'> {
  const accessToken = await getMercadoPagoAccessToken()
  if (!accessToken) return 'not_found'

  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=10`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  if (!res.ok) return 'not_found'

  const data = await res.json() as { results?: Array<{ id?: string; status?: string }> }
  const payment = data.results?.find((item) => item.status === 'approved') ?? data.results?.[0]
  if (!payment) return 'pending'

  return payment.status === 'approved' ? 'paid' : 'pending'
}

export function verifyMercadoPagoWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  return expected === signature
}
