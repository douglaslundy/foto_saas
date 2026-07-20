'use client'

import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/use-toast'

type OrderItem = {
  id: string
  photo_id: string
  price_cents: number
}

type Props = {
  orderId: string
  initialStatus: string
  totalCents: number
  clientEmail: string
  paymentMethod: string
  createdAt: string
  initialItems: Array<OrderItem>
}

const MAX_ATTEMPTS = 40
const POLL_INTERVAL_MS = 3000

export function OrderStatus({
  orderId,
  initialStatus,
  totalCents,
  clientEmail,
  paymentMethod,
  initialItems,
}: Props) {
  const { toast } = useToast()
  const [status, setStatus] = useState(initialStatus)
  const [downloading, setDownloading] = useState(false)
  const attemptsRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (status === 'paid') return

    const poll = async () => {
      attemptsRef.current += 1
      if (attemptsRef.current > MAX_ATTEMPTS) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        return
      }

      try {
        const res = await fetch(`/api/orders/${orderId}/status`)
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'paid') {
            setStatus('paid')
            if (intervalRef.current) clearInterval(intervalRef.current)
          }
        }
      } catch {
        // network error — keep polling
      }
    }

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [orderId, status])

  async function handleDownloadIndividual() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/download`)
      if (!res.ok) {
        toast({ title: 'Erro ao gerar links de download', variant: 'destructive' })
        return
      }
      const data = await res.json() as { downloads: Array<{ photoId: string; url: string }> }
      if (!data.downloads || data.downloads.length === 0) {
        toast({ title: 'Nenhuma foto disponível para download', variant: 'destructive' })
        return
      }
      for (const item of data.downloads) {
        const a = document.createElement('a')
        a.href = item.url
        a.download = ''
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        // pequeno intervalo entre cliques para o navegador não bloquear downloads múltiplos
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    } catch {
      toast({ title: 'Erro de conexão ao baixar fotos', variant: 'destructive' })
    } finally {
      setDownloading(false)
    }
  }

  const isPaid = status === 'paid'

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          {isPaid ? '✅ Pedido Confirmado' : '⏳ Aguardando Pagamento'}
        </h1>
        <p className="text-muted-foreground">Pedido #{orderId.slice(0, 8)}</p>
      </div>

      <div className="border rounded p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">E-mail</span>
          <span>{clientEmail}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span>
            {(totalCents / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pagamento</span>
          <span>{paymentMethod === 'pix' ? 'PIX' : 'Cartão'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className={isPaid ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
            {isPaid ? 'Pago' : 'Pendente'}
          </span>
        </div>
      </div>

      {isPaid && (
        <div className="space-y-3">
          <h2 className="font-semibold">Downloads</h2>
          <p className="text-sm text-muted-foreground">
            {initialItems.length} foto(s) disponíveis para download.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDownloadIndividual}
              disabled={downloading}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium disabled:opacity-60"
            >
              {downloading ? 'Baixando...' : 'Baixar Fotos'}
            </button>
            <a
              href={`/api/orders/${orderId}/download-zip`}
              className="inline-flex items-center gap-2 border border-primary text-primary px-4 py-2 rounded text-sm font-medium hover:bg-primary/5"
            >
              Baixar todas (.zip)
            </a>
          </div>
        </div>
      )}

      {!isPaid && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground animate-pulse">Confirmando pagamento...</p>
          <p className="text-sm text-muted-foreground">
            Após o pagamento confirmado, seus downloads aparecerão aqui. Esta página atualiza
            automaticamente.
          </p>
        </div>
      )}
    </div>
  )
}
