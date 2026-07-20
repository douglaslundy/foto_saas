'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle, Copy } from 'lucide-react'

interface PixDisplayProps {
  pixQrCode: string
  pixQrCodeBase64: string
  orderId: string
}

const MAX_ATTEMPTS = 60
const POLL_INTERVAL_MS = 3000

export function PixDisplay({ pixQrCode, pixQrCodeBase64, orderId }: PixDisplayProps) {
  const [copied, setCopied] = useState(false)
  const attemptsRef = useRef(0)

  // A promessa na tela é "confirmado automaticamente" — então esta tela precisa
  // checar sozinha o status do pagamento e levar o cliente para a página de
  // downloads assim que o PIX for aprovado, sem exigir clique manual.
  useEffect(() => {
    const interval = setInterval(async () => {
      attemptsRef.current += 1
      if (attemptsRef.current > MAX_ATTEMPTS) {
        clearInterval(interval)
        return
      }

      try {
        const res = await fetch(`/api/orders/${orderId}/status`)
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'paid') {
            clearInterval(interval)
            window.location.href = `/pedido/${orderId}`
          }
        }
      } catch {
        // erro de rede — tenta de novo no próximo tick
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [orderId])

  async function copyCode() {
    await navigator.clipboard.writeText(pixQrCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">
        Escaneie o QR Code ou copie o código PIX abaixo. O pedido{' '}
        <strong>#{orderId.slice(0, 8)}</strong> será confirmado automaticamente após o pagamento —
        esta página redireciona sozinha assim que identificar a confirmação.
      </p>

      {pixQrCodeBase64 && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${pixQrCodeBase64}`}
            alt="QR Code PIX"
            className="h-48 w-48 border rounded"
          />
        </div>
      )}

      <div className="flex gap-2 items-center">
        <code className="flex-1 bg-muted rounded px-3 py-2 text-xs text-left break-all">
          {pixQrCode}
        </code>
        <Button variant="outline" size="sm" onClick={copyCode}>
          {copied ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground animate-pulse">Aguardando confirmação do pagamento...</p>

      <p className="text-xs text-muted-foreground">
        Se preferir, acesse manualmente em{' '}
        <a href={`/pedido/${orderId}`} className="underline">
          /pedido/{orderId.slice(0, 8)}...
        </a>
      </p>
    </div>
  )
}
