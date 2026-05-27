'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

const CONSENT_KEY = 'fotosaas_cookie_consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY)
    if (!consent) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">
          Usamos cookies essenciais para o funcionamento do site e cookies de sessão para o carrinho
          de compras. Ao continuar, você concorda com nossa{' '}
          <a href="/privacidade" className="underline">
            Política de Privacidade
          </a>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={decline}>
            Recusar
          </Button>
          <Button size="sm" onClick={accept}>
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  )
}
