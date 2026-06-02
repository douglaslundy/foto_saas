'use client'

import { useState } from 'react'
import { SendToClientModal } from './send-to-client-modal'

type Props = {
  eventId: string
  hasActiveReview: boolean
  canResend: boolean
  reviewId?: string
}

export function SendToClientButton({ eventId, hasActiveReview, canResend, reviewId }: Props) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  async function handleResend() {
    if (!reviewId) return
    setResending(true)
    try {
      await fetch(`/api/essay-reviews/${reviewId}/resend`, { method: 'POST' })
      setResendDone(true)
    } finally {
      setResending(false)
    }
  }

  if (sent || resendDone) {
    return (
      <span className="px-4 py-2 text-sm text-green-700 bg-green-50 rounded-lg border border-green-200">
        Link enviado!
      </span>
    )
  }

  if (hasActiveReview) {
    return (
      <span className="px-4 py-2 text-sm text-yellow-700 bg-yellow-50 rounded-lg border border-yellow-200">
        Link enviado (aguardando cliente)
      </span>
    )
  }

  if (canResend) {
    return (
      <button
        onClick={handleResend}
        disabled={resending}
        className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
      >
        {resending ? 'Reenviando…' : 'Reenviar link'}
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Enviar para cliente
      </button>
      {open && (
        <SendToClientModal
          eventId={eventId}
          onClose={() => setOpen(false)}
          onSent={() => { setOpen(false); setSent(true) }}
        />
      )}
    </>
  )
}
