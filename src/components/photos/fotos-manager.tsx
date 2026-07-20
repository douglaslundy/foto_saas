'use client'

import { useState, useEffect, useRef } from 'react'
import { PhotoUploader } from './uploader'
import { PhotoGrid } from './photo-grid'
import { useToast } from '@/components/ui/use-toast'
import { useConfirm } from '@/components/providers/confirm-provider'

export type Photo = {
  id: string
  status: string
  thumbnail_path: string | null
  public_storage_path: string | null
  created_at: string
  cacheBust?: number
}

interface FotosManagerProps {
  eventId: string
  initialPhotos: Photo[]
  storageBase: string
}

const POLL_INTERVAL_MS = 3000

export function FotosManager({ eventId, initialPhotos, storageBase }: FotosManagerProps) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [reprocessingAll, setReprocessingAll] = useState(false)
  const [reprocessMsg, setReprocessMsg] = useState<string | null>(null)
  const photosRef = useRef(photos)
  photosRef.current = photos

  // Enquanto houver foto em processamento (ex: após girar ou reprocessar), consulta
  // o status periodicamente e atualiza a miniatura em tempo real, sem precisar de F5.
  useEffect(() => {
    const hasPending = photos.some((p) => p.status === 'pending' || p.status === 'processing')
    if (!hasPending) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/photos?limit=200`)
        if (!res.ok) return
        const data = await res.json() as {
          photos: { id: string; status: string; thumbnail_path: string | null; public_storage_path: string | null }[]
        }
        setPhotos((prev) => {
          let changed = false
          const next = prev.map((p) => {
            const updated = data.photos.find((d) => d.id === p.id)
            if (updated && updated.status !== p.status) {
              changed = true
              return {
                ...p,
                status: updated.status,
                thumbnail_path: updated.thumbnail_path,
                public_storage_path: updated.public_storage_path,
                cacheBust: Date.now(),
              }
            }
            return p
          })
          return changed ? next : prev
        })
      } catch {
        // silencioso — tenta de novo no próximo tick
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [photos, eventId])

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

  function handleBulkRotate(photoIds: string[]) {
    const idSet = new Set(photoIds)
    setPhotos((prev) => prev.map((p) => (idSet.has(p.id) ? { ...p, status: 'pending' } : p)))
  }

  async function handleSetCover(publicStoragePath: string) {
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_image_path: publicStoragePath }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          title: 'Não foi possível definir a capa',
          description: (data as { error?: string }).error ?? 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Capa do evento atualizada', variant: 'success' })
    } catch {
      toast({ title: 'Erro de conexão ao definir a capa', variant: 'destructive' })
    }
  }

  function handleReprocess(photoId: string) {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, status: 'pending' } : p)))
  }

  async function handleReprocessAll() {
    const ok = await confirm({
      title: "Reaplicar marca d'água",
      description: `Reaplicar a marca d'água em todas as ${photosRef.current.length} fotos deste evento? Elas ficarão temporariamente indisponíveis até serem reprocessadas.`,
      confirmLabel: 'Reaplicar',
    })
    if (!ok) return
    setReprocessingAll(true)
    setReprocessMsg(null)
    try {
      const res = await fetch(`/api/events/${eventId}/reprocess`, { method: 'POST' })
      const data = await res.json() as { count?: number; error?: string }
      if (!res.ok) {
        setReprocessMsg(`Erro: ${data.error ?? 'falha ao reprocessar.'}`)
      } else {
        setPhotos((prev) => prev.map((p) => ({ ...p, status: 'pending' })))
        setReprocessMsg(`${data.count ?? photosRef.current.length} foto(s) enfileirada(s) para reprocessamento.`)
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
          onBulkRotate={handleBulkRotate}
          onReprocess={handleReprocess}
          onSetCover={handleSetCover}
        />
      </div>
    </div>
  )
}
