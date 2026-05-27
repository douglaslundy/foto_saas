'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle, Copy } from 'lucide-react'

interface PixDisplayProps {
  pixQrCode: string
  pixQrCodeBase64: string
  orderId: string
}

export function PixDisplay({ pixQrCode, pixQrCodeBase64, orderId }: PixDisplayProps) {
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    await navigator.clipboard.writeText(pixQrCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">
        Escaneie o QR Code ou copie o código PIX abaixo. O pedido{' '}
        <strong>#{orderId.slice(0, 8)}</strong> será confirmado automaticamente após o pagamento.
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

      <p className="text-xs text-muted-foreground">
        Após o pagamento, acesse seus downloads em{' '}
        <a href={`/pedido/${orderId}`} className="underline">
          /pedido/{orderId.slice(0, 8)}...
        </a>
      </p>
    </div>
  )
}
