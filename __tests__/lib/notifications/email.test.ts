/**
 * @jest-environment node
 */

// jest.mock is hoisted — cannot reference variables declared above it.
// Use jest.requireMock after import to get handles on the mock.
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}))

import nodemailer from 'nodemailer'
import { sendOrderConfirmation, sendSaleNotification } from '@/lib/notifications/email'

function getMockSendMail() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (nodemailer.createTransport as jest.Mock).mock.results[0]?.value?.sendMail as jest.Mock
}

describe('email notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Re-setup the mock chain after clearAllMocks
    ;(nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    })
  })

  it('sendOrderConfirmation calls sendMail with client email', async () => {
    await sendOrderConfirmation({
      to: 'cliente@email.com',
      orderId: 'order-123',
      totalCents: 4000,
      downloadUrl: 'https://app.com/pedido/order-123',
    })

    const mockSendMail = getMockSendMail()
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'cliente@email.com',
        subject: expect.stringContaining('Pedido'),
        html: expect.stringContaining('order-123'),
      })
    )
  })

  it('sendSaleNotification calls sendMail with photographer email', async () => {
    await sendSaleNotification({
      to: 'fotografo@email.com',
      orderId: 'order-123',
      totalCents: 4000,
      clientEmail: 'cliente@email.com',
    })

    const mockSendMail = getMockSendMail()
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'fotografo@email.com',
        subject: expect.stringContaining('venda'),
        html: expect.stringContaining('cliente@email.com'),
      })
    )
  })

  it('does not throw when sendMail fails', async () => {
    ;(nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: jest.fn().mockRejectedValue(new Error('Connection refused')),
    })

    await expect(
      sendOrderConfirmation({
        to: 'cliente@email.com',
        orderId: 'order-123',
        totalCents: 2000,
        downloadUrl: 'https://app.com/pedido/order-123',
      })
    ).resolves.not.toThrow()
  })
})
