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

  function handleReprocess(photoId: string) {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, status: 'pending' } : p)))
  }

  return (
    <div className="space-y-6">
      <PhotoUploader eventId={eventId} onPhotoReady={handlePhotoReady} />

      <div className="space-y-3">
        <p className="font-semibold text-sm text-muted-foreground">
          {photos.length} {photos.length === 1 ? 'foto' : 'fotos'} neste evento
        </p>
        <PhotoGrid
          photos={photos}
          storageBase={storageBase}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onReprocess={handleReprocess}
        />
      </div>
    </div>
  )
}
