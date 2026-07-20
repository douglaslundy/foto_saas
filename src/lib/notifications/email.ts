import nodemailer from 'nodemailer'
import { getSmtpConfig } from './smtp-settings'

async function getTransport() {
  const config = await getSmtpConfig()
  if (!config) return null
  return {
    transport: nodemailer.createTransport({
      host: config.host,
      port: config.port,
      auth: { user: config.user, pass: config.pass },
    }),
    from: config.from,
  }
}

export async function sendOrderConfirmation({
  to,
  orderId,
  totalCents,
  downloadUrl,
  studioName,
}: {
  to: string
  orderId: string
  totalCents: number
  downloadUrl: string
  studioName?: string
}): Promise<void> {
  try {
    const mailer = await getTransport()
    if (!mailer) { console.warn('[email] SMTP não configurado — pulando sendOrderConfirmation'); return }
    await mailer.transport.sendMail({
      from: mailer.from,
      to,
      subject: `Pedido confirmado — ${studioName ?? 'FotoSaaS'} #${orderId.slice(0, 8)}`,
      html: `
        <h2>Seu pedido foi confirmado! 🎉</h2>
        <p>Estúdio: <strong>${studioName ?? 'FotoSaaS'}</strong></p>
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
  studioName,
}: {
  to: string
  orderId: string
  totalCents: number
  clientEmail: string
  studioName?: string
}): Promise<void> {
  try {
    const mailer = await getTransport()
    if (!mailer) { console.warn('[email] SMTP não configurado — pulando sendSaleNotification'); return }
    await mailer.transport.sendMail({
      from: mailer.from,
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

export async function sendEssayReviewLink({
  to,
  clientName,
  reviewLink,
  directLink,
  accessPassword,
  sessionTitle,
  studioName,
}: {
  to: string
  clientName: string
  reviewLink: string
  directLink?: string
  accessPassword?: string
  sessionTitle: string
  studioName?: string
}): Promise<void> {
  try {
    const mailer = await getTransport()
    if (!mailer) { console.warn('[email] SMTP não configurado — pulando sendEssayReviewLink'); return }
    await mailer.transport.sendMail({
      from: mailer.from,
      to,
      subject: `${studioName ?? 'FotoSaaS'} — Selecione suas fotos do ensaio`,
      html: `
        <h2>Olá, ${clientName}!</h2>
        <p>Seu ensaio <strong>${sessionTitle}</strong> está pronto para seleção.</p>
        <p>Clique no botão abaixo para visualizar e selecionar suas fotos favoritas. O link expira em <strong>72 horas</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="${reviewLink}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            Selecionar minhas fotos
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;">Se o botão não funcionar, copie e cole este link: ${reviewLink}</p>
        ${accessPassword && directLink ? `
        <p style="color:#6b7280;font-size:12px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:16px;">
          Se o link acima pedir login, acesse <a href="${directLink}">${directLink}</a> e use a senha do ensaio: <strong>${accessPassword}</strong>
        </p>` : ''}
      `,
    })
  } catch (err) {
    console.error('[email] sendEssayReviewLink failed:', err)
  }
}

export async function sendEssaySubmitted({
  to,
  clientName,
  sessionTitle,
  selectedCount,
  dashboardUrl,
  studioName,
}: {
  to: string
  clientName: string
  sessionTitle: string
  selectedCount: number
  dashboardUrl: string
  studioName?: string
}): Promise<void> {
  try {
    const mailer = await getTransport()
    if (!mailer) { console.warn('[email] SMTP não configurado — pulando sendEssaySubmitted'); return }
    await mailer.transport.sendMail({
      from: mailer.from,
      to,
      subject: `${clientName} selecionou fotos — ${sessionTitle}`,
      html: `
        <h2>Seleção recebida!</h2>
        <p><strong>${clientName}</strong> acabou de selecionar as fotos do ensaio <strong>${sessionTitle}</strong>.</p>
        <p>Total selecionado: <strong>${selectedCount} foto${selectedCount !== 1 ? 's' : ''}</strong></p>
        <p style="margin: 24px 0;">
          <a href="${dashboardUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            Ver seleção no dashboard
          </a>
        </p>
      `,
    })
  } catch (err) {
    console.error('[email] sendEssaySubmitted failed:', err)
  }
}

export async function sendEssayDelivered({
  to,
  clientName,
  sessionTitle,
  photoCount,
  downloadLink,
  studioName,
}: {
  to: string
  clientName: string
  sessionTitle: string
  photoCount: number
  downloadLink: string
  studioName?: string
}): Promise<void> {
  try {
    const mailer = await getTransport()
    if (!mailer) { console.warn('[email] SMTP não configurado — pulando sendEssayDelivered'); return }
    await mailer.transport.sendMail({
      from: mailer.from,
      to,
      subject: `${studioName ?? 'FotoSaaS'} — Suas fotos do ensaio estão prontas!`,
      html: `
        <h2>Olá, ${clientName}!</h2>
        <p>As fotos do seu ensaio <strong>${sessionTitle}</strong> já foram tratadas e estão prontas.</p>
        <p>Total: <strong>${photoCount} foto${photoCount !== 1 ? 's' : ''}</strong>, compactadas em um arquivo .zip, sem perda de qualidade.</p>
        <p style="margin: 24px 0;">
          <a href="${downloadLink}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            Baixar minhas fotos
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;">Se o botão não funcionar, copie e cole este link: ${downloadLink}</p>
      `,
    })
  } catch (err) {
    console.error('[email] sendEssayDelivered failed:', err)
  }
}

export async function sendPasswordReset({
  to,
  name,
  tempPassword,
  loginUrl,
  studioName,
}: {
  to: string
  name?: string
  tempPassword: string
  loginUrl: string
  studioName?: string
}): Promise<void> {
  try {
    const mailer = await getTransport()
    if (!mailer) { console.warn('[email] SMTP não configurado — pulando sendPasswordReset'); return }
    await mailer.transport.sendMail({
      from: mailer.from,
      to,
      subject: `${studioName ?? 'FotoSaaS'} — Sua senha foi redefinida`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="font-size:22px;margin-bottom:8px;">Olá${name ? `, ${name}` : ''}!</h2>
          <p style="color:#666;margin-bottom:24px;">Sua senha de acesso ao portal de fotos foi redefinida.</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 8px 0;"><strong>E-mail:</strong> ${to}</p>
            <p style="margin:0;"><strong>Nova senha temporária:</strong> <code style="background:#e0e0e0;padding:2px 8px;border-radius:4px;">${tempPassword}</code></p>
          </div>
          <a href="${loginUrl}" style="display:inline-block;background:#0d0f14;color:white;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:600;">Acessar portal →</a>
        </div>
      `,
    })
  } catch (err) {
    console.error('[email] sendPasswordReset failed:', err)
  }
}

export async function sendRegistrationNotification({
  to,
  studioName,
  photographerName,
  email,
  city,
  phone,
  cpfCnpj,
}: {
  to: string
  studioName: string
  photographerName: string
  email: string
  city: string
  phone: string
  cpfCnpj: string
}): Promise<void> {
  try {
    const mailer = await getTransport()
    if (!mailer) { console.warn('[email] SMTP não configurado — pulando sendRegistrationNotification'); return }
    await mailer.transport.sendMail({
      from: mailer.from,
      to,
      subject: `Novo pedido de cadastro — ${studioName}`,
      html: `
        <h2>Novo pedido de cadastro</h2>
        <p><strong>Estúdio:</strong> ${studioName}</p>
        <p><strong>Fotógrafo:</strong> ${photographerName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Cidade:</strong> ${city}</p>
        <p><strong>Telefone:</strong> ${phone}</p>
        <p><strong>CPF/CNPJ:</strong> ${cpfCnpj}</p>
        <p style="margin-top:16px">
          <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/admin/cadastros"
             style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
            Revisar no painel admin
          </a>
        </p>
      `,
    })
  } catch (err) {
    console.error('[email] sendRegistrationNotification failed:', err)
  }
}

export async function sendRegistrationApproved({
  to,
  photographerName,
  loginUrl,
}: {
  to: string
  photographerName: string
  loginUrl: string
}): Promise<void> {
  try {
    const mailer = await getTransport()
    if (!mailer) { console.warn('[email] SMTP não configurado — pulando sendRegistrationApproved'); return }
    await mailer.transport.sendMail({
      from: mailer.from,
      to,
      subject: 'Seu cadastro foi aprovado!',
      html: `
        <h2>Parabéns, ${photographerName}!</h2>
        <p>Seu cadastro foi aprovado. Acesse agora o painel do seu estúdio:</p>
        <p style="margin-top:16px">
          <a href="${loginUrl}"
             style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
            Entrar no painel
          </a>
        </p>
      `,
    })
  } catch (err) {
    console.error('[email] sendRegistrationApproved failed:', err)
  }
}

export async function sendRegistrationRejected({
  to,
  photographerName,
  notes,
}: {
  to: string
  photographerName: string
  notes?: string
}): Promise<void> {
  try {
    const mailer = await getTransport()
    if (!mailer) { console.warn('[email] SMTP não configurado — pulando sendRegistrationRejected'); return }
    await mailer.transport.sendMail({
      from: mailer.from,
      to,
      subject: 'Atualização sobre seu cadastro',
      html: `
        <h2>Olá, ${photographerName}</h2>
        <p>Infelizmente não foi possível aprovar seu cadastro no momento.</p>
        ${notes ? `<p><strong>Motivo:</strong> ${notes}</p>` : ''}
        <p>Se tiver dúvidas, entre em contato conosco.</p>
      `,
    })
  } catch (err) {
    console.error('[email] sendRegistrationRejected failed:', err)
  }
}
