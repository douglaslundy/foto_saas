'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'

export function SendFinalDeliveryButton({ reviewId, photoCount }: { reviewId: string; photoCount: number }) {
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const ok = await confirm({
      title: 'Enviar ensaio',
      description: `Enviar as ${photoCount} foto${photoCount !== 1 ? 's' : ''} tratada${photoCount !== 1 ? 's' : ''} ao cliente por e-mail? Ele receberá um link para baixar tudo em um arquivo .zip.`,
      confirmLabel: 'Enviar',
    })
    if (!ok) return

    setSending(true)
    try {
      const res = await fetch(`/api/essay-reviews/${reviewId}/send`, { method: 'POST' })
      if (res.ok) {
        toast({ title: 'Ensaio enviado ao cliente!', variant: 'success' })
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: 'Erro ao enviar ensaio', description: (data as { error?: string }).error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erro de conexão ao enviar ensaio', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={sending}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-cta)] text-[var(--color-cta-fg)] text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
      title="Enviar as fotos tratadas ao cliente por e-mail"
    >
      {sending ? 'Enviando…' : '✉ Enviar ensaio'}
    </button>
  )
}
