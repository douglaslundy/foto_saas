'use client'

import { useEffect, useState, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'

type CartItem = {
  id: string
  photo_id: string
  event_id: string
  price_cents: number
  photos?: { public_storage_path: string }
}

interface CartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCountChange: (count: number) => void
}

export function CartDrawer({ open, onOpenChange, onCountChange }: CartDrawerProps) {
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCart = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cart')
      const data = await res.json()
      setItems(data.items ?? [])
      onCountChange(data.items?.length ?? 0)
    } catch (err) {
      console.error('Failed to fetch cart:', err)
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => {
    if (open) fetchCart()
  }, [open, fetchCart])

  async function removeItem(photoId: string) {
    await fetch(`/api/cart/${photoId}`, { method: 'DELETE' })
    await fetchCart()
  }

  const subtotal = items.reduce((sum, item) => sum + item.price_cents, 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Carrinho</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full pt-4">
          {loading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Seu carrinho está vazio.</p>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 border rounded">
                    {item.photos?.public_storage_path && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.photos.public_storage_path}
                        alt="Foto"
                        className="h-16 w-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {(item.price_cents / 100).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.photo_id)}
                      aria-label="Remover do carrinho"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="pt-4 space-y-3">
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Subtotal</span>
                  <span>
                    {(subtotal / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false)
                    window.location.href = '/checkout'
                  }}
                >
                  Finalizar Compra
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
