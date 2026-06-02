'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NavbarProps {
  userName: string
  userRole: 'admin' | 'photographer' | 'sub_photographer' | 'viewer'
  pendingCount?: number
}

const navLinks = [
  { href: '/dashboard', label: 'Início', exact: true },
  { href: '/dashboard/eventos', label: 'Eventos' },
  { href: '/dashboard/financeiro', label: 'Financeiro' },
  { href: '/dashboard/clientes', label: 'Clientes' },
  { href: '/dashboard/equipe', label: 'Equipe' },
  { href: '/dashboard/configuracoes', label: 'Configurações' },
]

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function Navbar({ userName, userRole, pendingCount = 0 }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 h-14 flex items-center px-6 gap-6 border-b border-[#e5e7eb] bg-white">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0 mr-2">
        <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="7" r="3" stroke="white" strokeWidth="1.5"/>
            <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="font-semibold text-sm text-[#111827]">FotoSaaS</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1 flex-1">
        {navLinks.map((link) => {
          const isActive = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(link.href + '/')
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#eff6ff] text-[#2563eb]'
                  : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
        {userRole === 'photographer' && (
          <Link
            href="/dashboard/aprovacoes"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
              pathname === '/dashboard/aprovacoes' || pathname.startsWith('/dashboard/aprovacoes/')
                ? 'bg-[#eff6ff] text-[#2563eb]'
                : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]'
            }`}
          >
            Aprovações
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#2563eb] text-white text-[10px] font-bold">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </Link>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        {userRole === 'admin' && (
          <Link
            href="/admin"
            className="hidden sm:flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#111827] text-white hover:bg-[#1f2937] transition-colors"
          >
            Admin
          </Link>
        )}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#eff6ff] border border-[#bfdbfe] flex items-center justify-center text-[11px] font-semibold text-[#2563eb]">
            {getInitials(userName)}
          </div>
          <span className="hidden md:block text-sm text-[#374151] max-w-[120px] truncate">{userName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#dc2626] transition-colors"
        >
          Sair
        </button>
      </div>
    </nav>
  )
}
