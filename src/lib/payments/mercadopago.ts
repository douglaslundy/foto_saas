import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createHmac } from 'crypto'

function getMPConfig(): MercadoPagoConfig {
  return new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
  })
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
  const config = getMPConfig()
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

export function verifyMercadoPagoWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  return expected === signature
}
