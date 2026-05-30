'use client'

import { useState } from 'react'

type Photo = {
  id: string
  status: string
  thumbnail_path: string | null
  public_storage_path: string | null
  created_at: string
}

const statusLabel: Record<string, string> = {
  ready: 'Pronta',
  processing: 'Processando…',
  error: 'Erro',
  pending: 'Aguardando',
}

export function PhotoGrid({ photos: initial, storageBase }: { photos: Photo[]; storageBase: string }) {
  const [photos, setPhotos] = useState(initial)
  const [deleting, setDeleting] = useState<Set<string>>(new Set())

  async function handleDelete(photoId: string) {
    if (!confirm('Deletar esta foto? Esta ação não pode ser desfeita.')) return
    setDeleting((prev) => new Set(prev).add(photoId))
    try {
      const res = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' })
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      } else {
        alert('Erro ao deletar foto.')
      }
    } finally {
      setDeleting((prev) => { const s = new Set(prev); s.delete(photoId); return s })
    }
  }

  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
        Nenhuma foto enviada ainda.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {photos.map((photo) => {
        const isDeleting = deleting.has(photo.id)
        return (
          <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
            {photo.thumbnail_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${storageBase}/${photo.thumbnail_path}`}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-xs text-muted-foreground text-center px-2">
                  {statusLabel[photo.status] ?? photo.status}
                </span>
              </div>
            )}

            {photo.status !== 'ready' && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-xs text-white font-medium">
                  {statusLabel[photo.status] ?? photo.status}
                </span>
              </div>
            )}

            {/* Botão deletar — aparece no hover */}
            <button
              onClick={() => handleDelete(photo.id)}
              disabled={isDeleting}
              className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              title="Deletar foto"
            >
              {isDeleting ? '…' : '×'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
