'use client'

import { useState } from 'react'
import { PhotoGrid, type Photo } from './photo-grid'
import { FaceSearchIsland } from './face-search-island'

export function EventoPageClient({
  eventId,
  initialPhotos,
  total,
  isManager = false,
}: {
  eventId: string
  initialPhotos: Photo[]
  total: number
  isManager?: boolean
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
        isManager={isManager}
      />
    </div>
  )
}
