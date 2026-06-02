'use client'

import { useState, useEffect, useCallback } from 'react'

export type CarouselSlide = {
  id: string
  url: string
  title: string | null
  subtitle: string | null
}

interface CarouselBannerProps {
  slides: CarouselSlide[]
  className?: string
}

export function CarouselBanner({ slides, className = '' }: CarouselBannerProps) {
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), [slides.length])
  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length)

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [slides.length, next])

  if (slides.length === 0) return null

  const slide = slides[current]

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0'}`}
          style={{ backgroundImage: `url(${s.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          aria-hidden={i !== current}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

      {(slide.title || slide.subtitle) && (
        <div className="absolute bottom-8 left-8 right-8 text-white z-10">
          {slide.title && <p className="font-display text-2xl font-bold drop-shadow">{slide.title}</p>}
          {slide.subtitle && <p className="text-sm mt-1 opacity-80 drop-shadow">{slide.subtitle}</p>}
        </div>
      )}

      {slides.length > 1 && (
        <>
          <button onClick={prev} aria-label="Anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors z-10 text-lg">
            ‹
          </button>
          <button onClick={next} aria-label="Próximo"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors z-10 text-lg">
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === current ? 'bg-white w-4' : 'bg-white/50 w-2'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
