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
  studioName,
}: {
  to: string
  orderId: string
  totalCents: number
  downloadUrl: string
  studioName?: string
}): Promise<void> {
  try {
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
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

export async function sendEssayReviewLink({
  to,
  clientName,
  reviewLink,
  sessionTitle,
  studioName,
}: {
  to: string
  clientName: string
  reviewLink: string
  sessionTitle: string
  studioName?: string
}): Promise<void> {
  try {
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
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
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
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
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
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
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
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
    const transport = getTransport()
    await transport.sendMail({
      from: FROM,
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
