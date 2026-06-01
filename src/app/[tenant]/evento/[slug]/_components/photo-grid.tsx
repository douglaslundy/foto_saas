'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ShoppingCart } from 'lucide-react'

export type Photo = {
  id: string
  public_storage_path: string | null
  status: string
}

const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos-public`

function getPhotoUrl(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${STORAGE_URL}/${path}`
}

type PhotoGridProps = {
  initialPhotos: Photo[]
  eventId: string
  total: number
  filteredIds?: string[] | null  // null = show all; [] = show none; string[] = filtered set
}

export function PhotoGrid({ initialPhotos, eventId, total, filteredIds }: PhotoGridProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [lightbox, setLightbox] = useState<Photo | null>(null)
  const [loading, setLoading] = useState(false)
  const [addedToCart, setAddedToCart] = useState<Set<string>>(new Set())

  const addToCart = useCallback(async (photoId: string) => {
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
      })
      if (res.ok || res.status === 409) {
        // 409 = already in cart, still mark as added
        setAddedToCart((prev) => new Set(prev).add(photoId))
      }
    } catch (err) {
      console.error('Failed to add to cart:', err)
    }
  }, [])

  const displayed = filteredIds != null
    ? photos.filter((p) => filteredIds.includes(p.id))
    : photos

  const hasMore = filteredIds == null && photos.length < total

  async function loadMore() {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/photos?offset=${photos.length}&limit=48`)
      const data = await res.json() as { photos: Photo[] }
      setPhotos((prev) => [...prev, ...data.photos])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {displayed.length === 0 && filteredIds != null && (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Nenhuma foto encontrada com os critérios da busca.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {displayed.map((photo) => (
          <div
            key={photo.id}
            className="group relative aspect-square bg-muted rounded overflow-hidden"
            onClick={() => photo.status === 'ready' && setLightbox(photo)}
          >
            {photo.status === 'ready' && photo.public_storage_path ? (
              <>
                <img
                  src={getPhotoUrl(photo.public_storage_path) ?? ''}
                  alt=""
                  className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  draggable="false"
                  onContextMenu={(e) => e.preventDefault()}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    addToCart(photo.id)
                  }}
                  className={`absolute bottom-2 right-2 flex items-center gap-1 text-xs px-2 py-1 rounded transition-opacity ${
                    addedToCart.has(photo.id)
                      ? 'bg-green-600 text-white opacity-100'
                      : 'bg-primary text-primary-foreground opacity-0 group-hover:opacity-100'
                  }`}
                  aria-label="Adicionar ao carrinho"
                >
                  <ShoppingCart className="h-3 w-3" />
                  {addedToCart.has(photo.id) ? '✓' : '+'}
                </button>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-xs text-muted-foreground">Processando…</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-6">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? 'Carregando...' : 'Carregar mais'}
          </Button>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={getPhotoUrl(lightbox.public_storage_path) ?? ''}
            alt=""
            className="max-w-full max-h-full object-contain"
            draggable="false"
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl leading-none"
            onClick={() => setLightbox(null)}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
