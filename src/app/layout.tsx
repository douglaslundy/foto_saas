import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FotoSaaS',
  description: 'Plataforma de venda de fotos para fotógrafos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
