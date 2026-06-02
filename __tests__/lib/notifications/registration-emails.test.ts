jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({}),
  }),
}))

import nodemailer from 'nodemailer'
import {
  sendRegistrationNotification,
  sendRegistrationApproved,
  sendRegistrationRejected,
} from '@/lib/notifications/email'

describe('sendRegistrationNotification', () => {
  it('sends notification to super admin', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock
    await sendRegistrationNotification({
      to: 'admin@fotosaas.com',
      studioName: 'Studio Silva',
      photographerName: 'João Silva',
      email: 'joao@studio.com',
      city: 'São Paulo',
      phone: '11999999999',
      cpfCnpj: '123.456.789-00',
    })
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Studio Silva') })
    )
  })
})

describe('sendRegistrationApproved', () => {
  it('sends approval email to photographer', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock
    await sendRegistrationApproved({
      to: 'joao@studio.com',
      photographerName: 'João',
      loginUrl: 'http://app/login',
    })
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'joao@studio.com' })
    )
  })
})

describe('sendRegistrationRejected', () => {
  it('sends rejection email with optional notes', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock
    await sendRegistrationRejected({
      to: 'joao@studio.com',
      photographerName: 'João',
      notes: 'Dados incompletos.',
    })
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'joao@studio.com' })
    )
  })

  it('does not throw on smtp failure', async () => {
    const sendMail = (nodemailer.createTransport as jest.Mock)().sendMail as jest.Mock
    sendMail.mockRejectedValueOnce(new Error('SMTP error'))
    await expect(
      sendRegistrationRejected({ to: 'a@b.com', photographerName: 'X' })
    ).resolves.not.toThrow()
  })
})
