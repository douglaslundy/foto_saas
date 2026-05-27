/**
 * @jest-environment node
 */

// Must mock before import
const mockPaymentIntentsCreate = jest.fn()
const mockConstructEvent = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockPaymentIntentsCreate,
    },
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }))
})

import { createStripePaymentIntent, verifyStripeWebhook } from '@/lib/payments/stripe'

describe('stripe payment library', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('createStripePaymentIntent returns clientSecret and paymentIntentId', async () => {
    mockPaymentIntentsCreate.mockResolvedValue({
      id: 'pi_test123',
      client_secret: 'pi_test123_secret_abc',
    })

    const result = await createStripePaymentIntent({
      amountCents: 5000,
      currency: 'brl',
      metadata: { orderId: 'order123' },
    })

    expect(result.paymentIntentId).toBe('pi_test123')
    expect(result.clientSecret).toBe('pi_test123_secret_abc')
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: 'brl',
        metadata: { orderId: 'order123' },
      })
    )
  })

  it('verifyStripeWebhook calls constructEvent with raw body', () => {
    const mockEvent = { type: 'payment_intent.succeeded', data: { object: {} } }
    mockConstructEvent.mockReturnValue(mockEvent)

    const result = verifyStripeWebhook('raw-body', 'stripe-sig', 'whsec_test')

    expect(result).toEqual(mockEvent)
    expect(mockConstructEvent).toHaveBeenCalledWith('raw-body', 'stripe-sig', 'whsec_test')
  })
})
