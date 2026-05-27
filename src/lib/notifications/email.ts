import nodemailer from 'nodemailer'

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

const FROM = process.env.SMTP_FROM ?? 'noreply@fotosaas.com'

export async function sendOrderConfirmation({
  to,
  orderId,
  totalCents,
  downloadUrl,
}: {
  to: string
  orderId: string
  totalCents: number
  downloadUrl: string
}): Promise<void> {
  try {
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
      to,
      subject: `Pedido confirmado — #${orderId.slice(0, 8)}`,
      html: `
        <h2>Seu pedido foi confirmado! 🎉</h2>
        <p>Pedido: <strong>#${orderId}</strong></p>
        <p>Total: <strong>${(totalCents / 100).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })}</strong></p>
        <p>Acesse seus downloads: <a href="${downloadUrl}">${downloadUrl}</a></p>
        <p>O link expira em 24 horas.</p>
      `,
    })
  } catch (err) {
    console.error('[email] sendOrderConfirmation failed:', err)
    // Do not re-throw — email failure should not break payment flow
  }
}

export async function sendSaleNotification({
  to,
  orderId,
  totalCents,
  clientEmail,
}: {
  to: string
  orderId: string
  totalCents: number
  clientEmail: string
}): Promise<void> {
  try {
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
      to,
      subject: `Nova venda — ${(totalCents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })}`,
      html: `
        <h2>Você teve uma nova venda! 💰</h2>
        <p>Pedido: <strong>#${orderId}</strong></p>
        <p>Cliente: <strong>${clientEmail}</strong></p>
        <p>Valor: <strong>${(totalCents / 100).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })}</strong></p>
      `,
    })
  } catch (err) {
    console.error('[email] sendSaleNotification failed:', err)
  }
}
