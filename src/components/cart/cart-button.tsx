'use client'

import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CartDrawer } from './cart-drawer'

interface CartButtonProps {
  initialCount?: number
}

export function CartButton({ initialCount = 0 }: CartButtonProps) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(initialCount)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative"
        aria-label={`Carrinho com ${count} itens`}
      >
        <ShoppingCart className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>
      <CartDrawer open={open} onOpenChange={setOpen} onCountChange={setCount} />
    </>
  )
}
