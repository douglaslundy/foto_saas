import type { Metadata } from 'next'
import './globals.css'
import { getPlatformConfig } from '@/lib/platform-config'

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPlatformConfig()
  return {
    title: config.platformName,
    description: 'Plataforma de venda de fotos para fotógrafos',
    icons: config.faviconUrl ? { icon: config.faviconUrl } : undefined,
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
