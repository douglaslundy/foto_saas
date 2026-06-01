'use client'

import { useState } from 'react'

type Photo = {
  id: string
  status: string
  thumbnail_path: string | null
  public_storage_path: string | null
  created_at: string
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {photos.map((photo) => {
        const isDeleting = deleting.has(photo.id)
        const imgSrc = photo.thumbnail_path ? `${storageBase}/${photo.thumbnail_path}` : null

        return (
          <div
            key={photo.id}
            className="relative group aspect-square rounded-[var(--radius-sm)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-alt)]"
          >
            {imgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-xs text-[var(--color-ink-muted)] text-center px-2">
                  {photo.status}
                </span>
              </div>
            )}

            {/* Overlay hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
              {/* Botão excluir */}
              <button
                onClick={() => handleDelete(photo.id)}
                disabled={isDeleting}
                className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-[var(--color-danger)] hover:text-white transition-colors disabled:opacity-50"
                title="Excluir"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                )}
              </button>
            </div>

            {/* Status overlay — processando */}
            {photo.status === 'processing' && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                <div className="w-6 h-6 rounded-full border-2 border-[var(--color-gold)] border-t-transparent animate-spin" />
              </div>
            )}

            {/* Status overlay — pendente (sem thumbnail ainda) */}
            {photo.status === 'pending' && !imgSrc && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                <div className="w-6 h-6 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
              </div>
            )}

            {/* Status overlay — erro */}
            {photo.status === 'error' && (
              <div className="absolute inset-0 bg-[var(--color-danger)]/30 flex items-center justify-center pointer-events-none">
                <span className="text-white text-lg">&#9888;</span>
              </div>
            )}
          </div>
        )
      })}

      {(!photos || photos.length === 0) && (
        <div className="col-span-full py-16 text-center">
          <svg
            className="mx-auto mb-4 text-[var(--color-ink-muted)]"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.3"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p className="font-display text-lg font-semibold text-[var(--color-ink)]">
            Nenhuma foto enviada ainda.
          </p>
        </div>
      )}
    </div>
  )
}
