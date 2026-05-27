/**
 * @jest-environment node
 */

const mockPaymentCreate = jest.fn()

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Payment: jest.fn().mockImplementation(() => ({
    create: mockPaymentCreate,
  })),
}))

import { createMercadoPagoPix, verifyMercadoPagoWebhook } from '@/lib/payments/mercadopago'

describe('mercadopago payment library', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('createMercadoPagoPix returns pixQrCode and pixQrCodeBase64', async () => {
    mockPaymentCreate.mockResolvedValue({
      id: 123456,
      point_of_interaction: {
        transaction_data: {
          qr_code: '00020126...',
          qr_code_base64: 'base64string==',
        },
      },
      status: 'pending',
    })

    const result = await createMercadoPagoPix({
      amountCents: 5000,
      description: 'Fotos do evento',
      payerEmail: 'cliente@email.com',
      orderId: 'order123',
    })

    expect(result.pixQrCode).toBe('00020126...')
    expect(result.pixQrCodeBase64).toBe('base64string==')
    expect(result.paymentId).toBe('123456')
  })

  it('verifyMercadoPagoWebhook returns true for valid signature', () => {
    // We need to know what verifyMercadoPagoWebhook computes
    // It uses HMAC-SHA256(secret, payload) and compares to signature
    const crypto = require('crypto')
    const secret = 'mysecret'
    const payload = 'test-payload'
    const validSig = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    const result = verifyMercadoPagoWebhook(payload, validSig, secret)
    expect(result).toBe(true)
  })

  it('verifyMercadoPagoWebhook returns false for invalid signature', () => {
    const result = verifyMercadoPagoWebhook('payload', 'invalid-sig', 'secret')
    expect(result).toBe(false)
  })
})
