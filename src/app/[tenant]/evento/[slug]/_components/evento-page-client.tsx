'use client'

import { useState } from 'react'
import { PhotoGrid, type Photo } from './photo-grid'
import { FaceSearchIsland } from './face-search-island'

export function EventoPageClient({
  eventId,
  initialPhotos,
  total,
}: {
  eventId: string
  initialPhotos: Photo[]
  total: number
}) {
  const [filteredIds, setFilteredIds] = useState<string[] | null>(null)

  return (
    <div className="space-y-4">
      <FaceSearchIsland
        eventId={eventId}
        onResults={(ids) => setFilteredIds(ids)}
      />
      <PhotoGrid
        initialPhotos={initialPhotos}
        eventId={eventId}
        total={total}
        filteredIds={filteredIds}
      />
    </div>
  )
}
