import 'dotenv/config'
import nodemailer from 'nodemailer'
import { Worker, Job } from 'bullmq'
import { connection } from '../src/lib/queues/connection'
import type { EmailJobData } from '../src/lib/queues/email-queue'

function createTransport() {
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

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const transport = createTransport()
  const { data } = job

  if (data.type === 'order_confirmation') {
    const subject = `Pedido confirmado — ${data.studioName ? data.studioName + ' · ' : ''}#${data.orderId.slice(0, 8)}`
    await transport.sendMail({
      from: FROM,
      to: data.to,
      subject,
      html: `
        <h2>Seu pedido foi confirmado! 🎉</h2>
        ${data.studioName ? `<p style="color:#666">Estúdio: <strong>${data.studioName}</strong></p>` : ''}
        <p>Pedido: <strong>#${data.orderId}</strong></p>
        <p>Total: <strong>${formatBRL(data.totalCents)}</strong></p>
        <p>Acesse seus downloads: <a href="${data.downloadUrl}">${data.downloadUrl}</a></p>
        <p>O link expira em 24 horas.</p>
      `,
    })
  } else if (data.type === 'sale_notification') {
    const subject = `Nova venda — ${formatBRL(data.totalCents)}`
    await transport.sendMail({
      from: FROM,
      to: data.to,
      subject,
      html: `
        <h2>Você teve uma nova venda! 💰</h2>
        ${data.studioName ? `<p style="color:#666">Estúdio: <strong>${data.studioName}</strong></p>` : ''}
        <p>Pedido: <strong>#${data.orderId}</strong></p>
        <p>Cliente: <strong>${data.clientEmail}</strong></p>
        <p>Valor: <strong>${formatBRL(data.totalCents)}</strong></p>
      `,
    })
  } else if (data.type === 'client_invite') {
    await transport.sendMail({
      from: FROM,
      to: data.to,
      subject: `Acesso ao portal de fotos — ${data.studioName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="font-size:22px;margin-bottom:8px;">Bem-vindo(a)${data.name ? `, ${data.name}` : ''}!</h2>
          <p style="color:#666;margin-bottom:24px;"><strong>${data.studioName}</strong> criou um acesso para você no portal de fotos.</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 8px 0;"><strong>E-mail:</strong> ${data.to}</p>
            <p style="margin:0;"><strong>Senha temporária:</strong> <code style="background:#e0e0e0;padding:2px 8px;border-radius:4px;">${data.tempPassword}</code></p>
          </div>
          <a href="${data.loginUrl}" style="display:inline-block;background:#0d0f14;color:white;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:600;">Acessar portal →</a>
        </div>
      `,
    })
  } else if (data.type === 'order_delivery') {
    const subject = 'Suas fotos estão prontas para download!'
    await transport.sendMail({
      from: FROM,
      to: data.to,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="font-size:22px;margin-bottom:8px;">Suas fotos estão prontas!</h2>
          <p style="color:#666;margin-bottom:24px;">
            Suas fotos foram processadas e estão disponíveis para download.
          </p>
          <a href="${data.orderPageUrl}"
            style="display:inline-block;background:#0d0f14;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
            Ver meus downloads &rarr;
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px;">
            Ou acesse: <a href="${data.orderPageUrl}">${data.orderPageUrl}</a>
          </p>
        </div>
      `,
    })
  }
}

const worker = new Worker<EmailJobData>('email', processEmailJob, {
  connection,
  concurrency: 5,
})

worker.on('completed', (job) => {
  console.log(`[email-worker] ✓ job ${job.id} — ${job.data.type} → ${job.data.to}`)
})

worker.on('failed', (job, err) => {
  console.error(
    `[email-worker] ✗ job ${job?.id} — tentativa ${job?.attemptsMade}/${job?.opts?.attempts} — ${err.message}`
  )
})

worker.on('error', (err) => {
  console.error('[email-worker] Worker error:', err)
})

console.log('[email-worker] Started. Listening for jobs on queue "email"...')
