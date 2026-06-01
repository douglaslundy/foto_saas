'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Member = {
  id: string
  email: string
  role: string
  created_at: string
}

interface MemberListProps {
  members: Member[]
  canManage: boolean
  currentUserId: string
}

const roleLabel: Record<string, string> = {
  photographer: 'Fotógrafo Principal',
  sub_photographer: 'Sub-fotógrafo',
}

export function MemberList({ members, canManage, currentUserId }: MemberListProps) {
  const router = useRouter()
  const [removing, setRemoving] = useState<string | null>(null)

  async function handleRemove(memberId: string) {
    if (!confirm('Remover este colaborador da equipe?')) return
    setRemoving(memberId)
    try {
      const res = await fetch(`/api/team/${memberId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error ?? 'Erro ao remover colaborador.')
      }
    } catch {
      alert('Erro de rede. Tente novamente.')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="font-medium">Membros ({members.length})</h2>
      </div>
      <div className="divide-y">
        {members.map((m) => (
          <div key={m.id} className="px-4 py-3 flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">{m.email}</p>
              <p className="text-xs text-muted-foreground">
                Desde {new Date(m.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  m.role === 'photographer'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {roleLabel[m.role] ?? m.role}
              </span>
              {canManage && m.role === 'sub_photographer' && m.id !== currentUserId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
                  disabled={removing === m.id}
                  onClick={() => handleRemove(m.id)}
                >
                  {removing === m.id ? 'Removendo...' : 'Remover'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
