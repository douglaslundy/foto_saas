'use client'

import { useState } from 'react'
import { PhotoUploader } from './uploader'
import { PhotoGrid } from './photo-grid'

export type Photo = {
  id: string
  status: string
  thumbnail_path: string | null
  public_storage_path: string | null
  created_at: string
}

interface FotosManagerProps {
  eventId: string
  initialPhotos: Photo[]
  storageBase: string
}

export function FotosManager({ eventId, initialPhotos, storageBase }: FotosManagerProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [reprocessingAll, setReprocessingAll] = useState(false)
  const [reprocessMsg, setReprocessMsg] = useState<string | null>(null)

  function handlePhotoReady(photo: Photo) {
    setPhotos((prev) => {
      const exists = prev.some((p) => p.id === photo.id)
      if (exists) return prev.map((p) => (p.id === photo.id ? { ...p, ...photo } : p))
      return [photo, ...prev]
    })
  }

  function handleDelete(photoId: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  function handleBulkDelete(photoIds: string[]) {
    const idSet = new Set(photoIds)
    setPhotos((prev) => prev.filter((p) => !idSet.has(p.id)))
  }

  async function handleSetCover(publicStoragePath: string) {
    await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cover_image_path: publicStoragePath }),
    })
  }

  function handleReprocess(photoId: string) {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, status: 'pending' } : p)))
  }

  async function handleReprocessAll() {
    if (!confirm(`Reaplicar a marca d'água em todas as ${photos.length} fotos deste evento? Elas ficarão temporariamente indisponíveis até serem reprocessadas.`)) return
    setReprocessingAll(true)
    setReprocessMsg(null)
    try {
      const res = await fetch(`/api/events/${eventId}/reprocess`, { method: 'POST' })
      const data = await res.json() as { count?: number; error?: string }
      if (!res.ok) {
        setReprocessMsg(`Erro: ${data.error ?? 'falha ao reprocessar.'}`)
      } else {
        setPhotos((prev) => prev.map((p) => ({ ...p, status: 'pending' })))
        setReprocessMsg(`${data.count ?? photos.length} foto(s) enfileirada(s) para reprocessamento.`)
      }
    } catch {
      setReprocessMsg('Erro de conexão ao reprocessar.')
    } finally {
      setReprocessingAll(false)
    }
  }

  return (
    <div className="space-y-6">
      <PhotoUploader eventId={eventId} onPhotoReady={handlePhotoReady} />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-semibold text-sm text-muted-foreground">
            {photos.length} {photos.length === 1 ? 'foto' : 'fotos'} neste evento
          </p>
          {photos.length > 0 && (
            <button
              onClick={handleReprocessAll}
              disabled={reprocessingAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-xs font-medium hover:bg-[var(--color-surface-alt)] transition-colors disabled:opacity-50"
              title="Reaplicar marca d'água em todas as fotos do evento"
            >
              {reprocessingAll ? (
                <><span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" /> Enfileirando…</>
              ) : (
                <>↻ Reaplicar marca d&apos;água</>
              )}
            </button>
          )}
        </div>
        {reprocessMsg && (
          <p className="text-xs text-[var(--color-ink-muted)] bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded px-3 py-2">
            {reprocessMsg}
          </p>
        )}
        <PhotoGrid
          photos={photos}
          storageBase={storageBase}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onReprocess={handleReprocess}
          onSetCover={handleSetCover}
        />
      </div>
    </div>
  )
}
