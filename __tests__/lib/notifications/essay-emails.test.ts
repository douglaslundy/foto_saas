jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({}),
  }),
}))

import nodemailer from 'nodemailer'
import { sendEssayReviewLink, sendEssaySubmitted } from '@/lib/notifications/email'

describe('sendEssayReviewLink', () => {
  it('sends email with magic link to client', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock

    await sendEssayReviewLink({
      to: 'cliente@email.com',
      clientName: 'João Silva',
      reviewLink: 'http://app/auth/callback?next=/studio/ensaio-review/abc',
      sessionTitle: 'Ensaio Família Silva',
      studioName: 'Studio X',
    })

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'cliente@email.com',
        subject: expect.stringContaining('Studio X'),
      })
    )
  })

  it('does not throw on nodemailer failure', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock
    sendMail.mockRejectedValueOnce(new Error('SMTP error'))

    await expect(
      sendEssayReviewLink({
        to: 'cliente@email.com',
        clientName: 'João',
        reviewLink: 'http://app/link',
        sessionTitle: 'Ensaio',
        studioName: 'Studio',
      })
    ).resolves.not.toThrow()
  })
})

describe('sendEssaySubmitted', () => {
  it('sends notification email to photographer', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock

    await sendEssaySubmitted({
      to: 'fotografo@studio.com',
      clientName: 'João Silva',
      sessionTitle: 'Ensaio Família Silva',
      selectedCount: 15,
      dashboardUrl: 'http://app/dashboard/eventos/123/fotos',
      studioName: 'Studio X',
    })

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'fotografo@studio.com',
        subject: expect.stringContaining('João Silva'),
      })
    )
  })
})
