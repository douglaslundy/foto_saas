'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

type CartItem = {
  id: string
  photo_id: string
  event_id: string
  price_cents: number
  photos?: { public_storage_path: string | null }
}

type CartPackage = {
  name: string
  discount_percent: number
  min_quantity: number
}

type CartResponse = {
  items?: CartItem[]
  package?: CartPackage | null
  subtotal_cents?: number
  discount_cents?: number
  total_cents?: number
}

interface CartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCountChange: (count: number) => void
  tenantSlug?: string
}

export function CartDrawer({ open, onOpenChange, onCountChange, tenantSlug }: CartDrawerProps) {
  const [items, setItems] = useState<CartItem[]>([])
  const [cartPackage, setCartPackage] = useState<CartPackage | null>(null)
  const [subtotalCents, setSubtotalCents] = useState(0)
  const [discountCents, setDiscountCents] = useState(0)
  const [totalCents, setTotalCents] = useState(0)
  const [loading, setLoading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const fetchCart = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cart')
      const data = await res.json() as CartResponse
      const fetchedItems = data.items ?? []
      setItems(fetchedItems)
      setCartPackage(data.package ?? null)
      // Use API-computed values if present, otherwise fall back to client calculation
      const sub = data.subtotal_cents ?? fetchedItems.reduce((s, i) => s + i.price_cents, 0)
      const disc = data.discount_cents ?? 0
      setSubtotalCents(sub)
      setDiscountCents(disc)
      setTotalCents(data.total_cents ?? sub - disc)
      onCountChange(fetchedItems.length)
    } catch (err) {
      console.error('Failed to fetch cart:', err)
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => {
    if (open) fetchCart()
  }, [open, fetchCart])

  // Also refresh when fotosaas:cart-add fires and drawer is open
  useEffect(() => {
    const handler = () => { if (open) fetchCart() }
    window.addEventListener('fotosaas:cart-add', handler)
    return () => window.removeEventListener('fotosaas:cart-add', handler)
  }, [open, fetchCart])

  async function removeItem(photoId: string) {
    setRemovingId(photoId)
    try {
      await fetch(`/api/cart/${photoId}`, { method: 'DELETE' })
      await fetchCart()
    } finally {
      setRemovingId(null)
    }
  }

  function goToCheckout() {
    onOpenChange(false)
    const base = tenantSlug ? `/${tenantSlug}` : ''
    window.location.href = `${base}/checkout`
  }

  function thumbUrl(path: string | null | undefined): string | null {
    if (!path) return null
    if (path.startsWith('http')) return path
    return `${STORAGE_BASE}/${path}`
  }

  function formatBRL(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[480px] p-0 flex flex-col bg-[var(--color-card)] border-l border-[var(--color-border-strong)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
              Meu Carrinho
            </h2>
            {items.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-[var(--color-gold)] text-[var(--color-ink)] text-[10px] font-bold flex items-center justify-center leading-none">
                {items.length}
              </span>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full hover:bg-[var(--color-surface-alt)] flex items-center justify-center text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
            aria-label="Fechar carrinho"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--color-gold)] border-t-transparent animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-ink)] opacity-30 mb-4">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <p className="font-display text-base font-semibold text-[var(--color-ink)] mb-1">Carrinho vazio</p>
              <p className="text-sm text-[var(--color-ink-muted)]">Adicione fotos para comprar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const src = thumbUrl(item.photos?.public_storage_path)
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-[var(--radius-sm)] overflow-hidden bg-[var(--color-surface-alt)] flex-shrink-0">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="Foto" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--color-ink-muted)] text-xs">📷</div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--color-ink-muted)]">Foto digital</p>
                      <p className="font-display text-base font-semibold text-[var(--color-ink)] mt-0.5">
                        {item.price_cents === 0
                          ? 'Gratuita'
                          : formatBRL(item.price_cents)}
                      </p>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeItem(item.photo_id)}
                      disabled={removingId === item.photo_id}
                      aria-label="Remover do carrinho"
                      className="w-7 h-7 rounded-full hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] flex items-center justify-center text-[var(--color-ink-muted)] transition-colors text-xs disabled:opacity-40"
                    >
                      {removingId === item.photo_id ? '…' : '✕'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && !loading && (
          <div className="px-6 py-5 border-t border-[var(--color-border)] bg-[var(--color-card)]">
            {/* Discount row */}
            {cartPackage && discountCents > 0 && (
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-[var(--color-ink-muted)]">
                  Subtotal
                </span>
                <span className="text-[var(--color-ink-muted)]">
                  {formatBRL(subtotalCents)}
                </span>
              </div>
            )}
            {cartPackage && discountCents > 0 && (
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-green-600 font-medium">
                  Desconto ({cartPackage.name})
                </span>
                <span className="text-green-600 font-medium">
                  -{formatBRL(discountCents)}
                </span>
              </div>
            )}
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-sm text-[var(--color-ink-muted)]">
                {items.length} {items.length === 1 ? 'foto' : 'fotos'}
              </span>
              <span className="font-display text-2xl font-bold text-[var(--color-ink)]">
                {totalCents === 0
                  ? 'Gratuito'
                  : formatBRL(totalCents)}
              </span>
            </div>
            <button
              onClick={goToCheckout}
              className="w-full h-11 rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              Finalizar pedido →
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
