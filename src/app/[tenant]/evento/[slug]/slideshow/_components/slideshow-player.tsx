'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type Photo = { id: string; public_storage_path: string }

interface SlideshowPlayerProps {
  photos: Photo[]
  eventTitle?: string
  tenantSlug?: string
  eventSlug?: string
  intervalMs?: number
}

export function SlideshowPlayer({
  photos,
  eventTitle,
  tenantSlug,
  eventSlug,
  intervalMs = 4000,
}: SlideshowPlayerProps) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [headerVisible, setHeaderVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const showHeader = useCallback(() => {
    setHeaderVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setHeaderVisible(false), 3000)
  }, [])

  useEffect(() => {
    showHeader()
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [showHeader])

  if (photos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <p className="text-white/60 text-sm">Nenhuma foto disponível para o slideshow.</p>
      </div>
    )
  }

  const current = photos[index]
  const exitHref =
    tenantSlug && eventSlug ? `/${tenantSlug}/evento/${eventSlug}` : '#'

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col"
      onMouseMove={showHeader}
      onTouchStart={showHeader}
    >
      {/* Header — appears on hover, hides after 3s */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/50 to-transparent transition-opacity duration-300"
        style={{ opacity: headerVisible ? 1 : 0, pointerEvents: headerVisible ? 'auto' : 'none' }}
      >
        {eventTitle && (
          <p className="font-display text-white text-sm truncate max-w-[60%]">{eventTitle}</p>
        )}
        <div className="flex items-center gap-4 ml-auto">
          <span className="text-white/60 text-sm">
            {index + 1} / {photos.length}
          </span>
          <a
            href={exitHref}
            className="text-white/70 hover:text-white text-sm transition-colors leading-none"
            aria-label="Sair do slideshow"
          >
            ✕ Sair
          </a>
        </div>
      </div>

      {/* Foto central */}
      <div className="flex-1 flex items-center justify-center px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          src={current.public_storage_path}
          alt=""
          className="max-h-[85vh] max-w-full object-contain"
          draggable="false"
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Prev button */}
      <div className="absolute inset-y-0 left-4 flex items-center">
        <button
          onClick={prev}
          aria-label="Foto anterior"
          className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          ←
        </button>
      </div>

      {/* Next button */}
      <div className="absolute inset-y-0 right-4 flex items-center">
        <button
          onClick={next}
          aria-label="Próxima foto"
          className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          →
        </button>
      </div>

      {/* Play/pause — bottom center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <button
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pausar' : 'Reproduzir'}
          className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-sm text-xs"
        >
          {playing ? '⏸' : '▶'}
        </button>
      </div>
    </div>
  )
}
