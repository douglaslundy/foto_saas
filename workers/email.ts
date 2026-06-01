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
