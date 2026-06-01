'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

type CartItem = {
  id: string
  photo_id: string
  event_id: string
  price_cents: number
  photos?: { public_storage_path: string }
  events?: { title: string }
}

export default function CarrinhoPage() {
  const params = useParams()
  const tenantSlug = params?.tenant as string | undefined

  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCart = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cart')
      const data = await res.json()
      setItems(data.items ?? [])
    } catch (err) {
      console.error('Failed to fetch cart:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  async function removeItem(photoId: string) {
    await fetch(`/api/cart/${photoId}`, { method: 'DELETE' })
    await fetchCart()
  }

  const subtotal = items.reduce((sum, item) => sum + item.price_cents, 0)
  const subtotalFormatted = (subtotal / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
  const totalFormatted = subtotalFormatted

  const checkoutHref = tenantSlug ? `/${tenantSlug}/checkout` : '/checkout'

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl font-bold text-[var(--color-ink)] mb-8">
        Seu Carrinho
      </h1>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--color-gold)] border-t-transparent animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[var(--color-ink)] opacity-20 mb-4"
          >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <p className="font-display text-xl font-semibold text-[var(--color-ink)] mb-2">
            Carrinho vazio
          </p>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Adicione fotos aos favoritos para comprar
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Lista de fotos */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-4"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-[var(--radius-sm)] overflow-hidden bg-[var(--color-surface-alt)] flex-shrink-0">
                  {item.photos?.public_storage_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photos.public_storage_path}
                      alt="Foto"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-ink-muted)] text-lg">
                      📷
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                    {item.events?.title ?? 'Foto'}
                  </p>
                  <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">Foto digital</p>
                </div>

                {/* Price + remove */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <p className="font-display text-lg font-semibold text-[var(--color-ink)]">
                    {(item.price_cents / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                  <button
                    onClick={() => removeItem(item.photo_id)}
                    aria-label="Remover item"
                    className="w-7 h-7 rounded-full hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] flex items-center justify-center text-[var(--color-ink-muted)] transition-colors text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo */}
          <div
            className="rounded-[var(--radius)] border border-[var(--color-border-strong)] bg-[var(--color-card)] p-6 h-fit"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)] mb-4">
              Resumo
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[var(--color-ink-muted)]">
                <span>{items.length} foto(s)</span>
                <span>{subtotalFormatted}</span>
              </div>
              <div className="flex justify-between text-[var(--color-ink-muted)]">
                <span>Entrega</span>
                <span>Digital (grátis)</span>
              </div>
              <div className="border-t border-[var(--color-border)] pt-2 flex justify-between font-semibold">
                <span className="text-[var(--color-ink)]">Total</span>
                <span className="font-display text-lg text-[var(--color-ink)]">
                  {totalFormatted}
                </span>
              </div>
            </div>

            <a
              href={checkoutHref}
              className="mt-4 block w-full h-11 rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-white text-sm font-semibold text-center leading-[44px] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              Prosseguir para pagamento
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
