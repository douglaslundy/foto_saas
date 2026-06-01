import { Navbar } from '@/components/navbar'

interface AppShellProps {
  children: React.ReactNode
  userName: string
  userRole: 'admin' | 'photographer' | 'sub_photographer' | 'viewer'
}

export function AppShell({ children, userName, userRole }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <Navbar userName={userName} userRole={userRole} />
      <main className="max-w-[1200px] mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  )
}
