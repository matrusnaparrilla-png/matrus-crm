'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SalaoUser, SalaoUserRole } from '@/types/salao'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Plus, Loader2 } from 'lucide-react'

const ROLE_LABELS: Record<SalaoUserRole, string> = { admin: 'Administrador', gerente: 'Gerente', garcom: 'Garçom' }

export function UsuariosClient({
  initialUsers, waiters, unitId,
}: {
  initialUsers: SalaoUser[]
  waiters: { id: string; name: string }[]
  unitId: string | null
}) {
  const supabase = createClient()
  const [users, setUsers] = useState(initialUsers)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<SalaoUserRole>('gerente')
  const [waiterId, setWaiterId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim() || !email.trim() || password.length < 8 || !unitId) {
      toast.error('Preencha nome, e-mail e uma senha com pelo menos 8 caracteres')
      return
    }
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, unit_id: unitId, waiter_id: waiterId || undefined }),
    })
    const body = await res.json()
    setSaving(false)
    if (!res.ok) {
      toast.error(body.error ?? 'Erro ao criar usuário')
      return
    }
    toast.success('Usuário criado')
    setShowForm(false)
    setName(''); setEmail(''); setPassword(''); setRole('gerente'); setWaiterId('')
    const { data } = await supabase.from('salao_users').select('*').order('created_at', { ascending: false })
    setUsers(data ?? [])
  }

  async function toggleActive(u: SalaoUser) {
    const { error } = await supabase.from('salao_users').update({ active: !u.active }).eq('id', u.id)
    if (error) toast.error('Erro ao atualizar usuário')
    else setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Usuários</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Acesso ao painel administrativo</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2">
          <Plus size={16} /> Novo usuário
        </button>
      </div>

      <div className="card divide-y divide-surface-border overflow-hidden">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{u.name}</p>
              <p className="text-xs text-neutral-500">{u.email} · {ROLE_LABELS[u.role]}</p>
            </div>
            <button
              onClick={() => toggleActive(u)}
              className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', u.active ? 'text-green-400 border-green-400/30' : 'text-neutral-500 border-surface-border')}
            >
              {u.active ? 'Ativo' : 'Inativo'}
            </button>
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-neutral-500 text-center py-10">Nenhum usuário cadastrado</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="card p-6 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-white mb-1">Novo usuário</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="input" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" type="email" className="input" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha inicial (mín. 8 caracteres)" type="text" className="input" />
            <select value={role} onChange={(e) => setRole(e.target.value as SalaoUserRole)} className="input">
              <option value="gerente">Gerente</option>
              <option value="admin">Administrador</option>
              <option value="garcom">Garçom</option>
            </select>
            {role === 'garcom' && (
              <select value={waiterId} onChange={(e) => setWaiterId(e.target.value)} className="input">
                <option value="">Vincular a um garçom cadastrado</option>
                {waiters.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 py-2.5 text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                {saving && <Loader2 size={15} className="animate-spin" />} Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
