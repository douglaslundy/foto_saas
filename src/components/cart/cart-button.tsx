'use client'

import { useEffect, useState } from 'react'
import { CartDrawer } from './cart-drawer'

interface CartButtonProps {
  initialCount?: number
  tenantSlug?: string
}

export function CartButton({ initialCount = 0, tenantSlug }: CartButtonProps) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(initialCount)

  // Listen for cart-add events from photo grid
  useEffect(() => {
    const handler = () => setCount((c) => c + 1)
    window.addEventListener('fotosaas:cart-add', handler)
    return () => window.removeEventListener('fotosaas:cart-add', handler)
  }, [])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Carrinho com ${count} itens`}
        className="relative w-11 h-11 rounded-full bg-[var(--color-ink)] text-white flex items-center justify-center hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-gold)] text-[var(--color-ink)] text-[10px] font-bold flex items-center justify-center leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <CartDrawer
        open={open}
        onOpenChange={setOpen}
        onCountChange={setCount}
        tenantSlug={tenantSlug}
      />
    </>
  )
}
