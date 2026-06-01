'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Photo = { id: string; public_storage_path: string }

interface SlideshowPlayerProps {
  photos: Photo[]
  intervalMs?: number
}

export function SlideshowPlayer({ photos, intervalMs = 4000 }: SlideshowPlayerProps) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % photos.length)
  }, [photos.length])

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + photos.length) % photos.length)
  }, [photos.length])

  useEffect(() => {
    if (!playing || photos.length === 0) return
    const timer = setInterval(next, intervalMs)
    return () => clearInterval(timer)
  }, [playing, next, intervalMs, photos.length])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { prev() }
      if (e.key === 'ArrowRight') { next() }
      if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p) }
      if (e.key === 'Escape') { window.history.back() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [prev, next])

  if (photos.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-20">
        Nenhuma foto disponível para o slideshow.
      </p>
    )
  }

  const current = photos[index]

  return (
    <div className="relative bg-black min-h-screen flex items-center justify-center">
      {/* Photo */}
      <div className="w-full h-screen flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          src={current.public_storage_path}
          alt=""
          className="max-w-full max-h-screen object-contain"
          draggable="false"
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={prev}
          className="bg-black/60 border-white/20 text-white hover:bg-black/80"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPlaying((p) => !p)}
          className="bg-black/60 border-white/20 text-white hover:bg-black/80"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={next}
          className="bg-black/60 border-white/20 text-white hover:bg-black/80"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-white/60 text-sm">
          {index + 1} / {photos.length}
        </span>
      </div>

      {/* Keyboard hint */}
      <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/30 select-none">
        ← → navegar · Espaço pausar · Esc fechar
      </p>
    </div>
  )
}
