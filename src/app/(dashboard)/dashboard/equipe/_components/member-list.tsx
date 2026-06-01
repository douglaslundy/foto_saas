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
  const [editing, setEditing] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

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

  function startEdit(member: Member) {
    setEditing(member.id)
    setEditRole((prev) => ({ ...prev, [member.id]: member.role }))
  }

  function cancelEdit(memberId: string) {
    setEditing(null)
    setEditRole((prev) => {
      const next = { ...prev }
      delete next[memberId]
      return next
    })
  }

  async function handleSaveRole(memberId: string) {
    const role = editRole[memberId]
    if (!role) return
    setSaving(memberId)
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (res.ok) {
        setEditing(null)
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error ?? 'Erro ao atualizar papel.')
      }
    } catch {
      alert('Erro de rede. Tente novamente.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="font-medium">Membros ({members.length})</h2>
      </div>
      <div className="divide-y">
        {members.map((m) => (
          <div key={m.id} className="px-4 py-3 flex items-center justify-between text-sm gap-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{m.email}</p>
              <p className="text-xs text-muted-foreground">
                Desde {new Date(m.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {editing === m.id ? (
                /* Inline role editor */
                <>
                  <select
                    value={editRole[m.id] ?? m.role}
                    onChange={(e) =>
                      setEditRole((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    className="h-7 rounded border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-xs px-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)]"
                    disabled={saving === m.id}
                  >
                    <option value="photographer">Fotógrafo Principal</option>
                    <option value="sub_photographer">Sub-fotógrafo</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                    disabled={saving === m.id}
                    onClick={() => handleSaveRole(m.id)}
                  >
                    {saving === m.id ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={saving === m.id}
                    onClick={() => cancelEdit(m.id)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                /* Normal view */
                <>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      m.role === 'photographer'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {roleLabel[m.role] ?? m.role}
                  </span>
                  {canManage && m.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                      disabled={removing === m.id}
                      onClick={() => startEdit(m)}
                    >
                      Editar
                    </Button>
                  )}
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
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
