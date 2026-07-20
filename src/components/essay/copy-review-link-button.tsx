'use client'

import { useState } from 'react'

type Props = {
  reviewId: string
  tenantSlug: string
}

export function CopyReviewLinkButton({ reviewId, tenantSlug }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const link = `${window.location.origin}/${tenantSlug}/ensaio-review/${reviewId}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-sm font-medium hover:bg-[var(--color-surface-alt)] transition-colors"
      title="Copiar o link do ensaio para enviar manualmente ao cliente"
    >
      {copied ? '✓ Link copiado!' : '🔗 Copiar link'}
    </button>
  )
}
