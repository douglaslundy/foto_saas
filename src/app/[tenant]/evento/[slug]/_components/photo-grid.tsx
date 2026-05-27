'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export type Photo = {
  id: string
  public_storage_path: string | null
  status: string
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
            className="relative aspect-square bg-muted rounded overflow-hidden"
            onClick={() => photo.status === 'ready' && setLightbox(photo)}
          >
            {photo.status === 'ready' && photo.public_storage_path ? (
              <img
                src={photo.public_storage_path}
                alt=""
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                draggable="false"
                onContextMenu={(e) => e.preventDefault()}
              />
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
            src={lightbox.public_storage_path!}
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
