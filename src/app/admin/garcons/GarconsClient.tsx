'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QrCodeModal } from '@/components/salao/QrCodeModal'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Plus, QrCode as QrCodeIcon, RefreshCcw, Pencil, Loader2 } from 'lucide-react'

interface QrCodeRow {
  id: string
  token: string
  active: boolean
  regenerated_at: string | null
}

interface WaiterRow {
  id: string
  unit_id: string
  name: string
  phone: string | null
  photo_url: string | null
  active: boolean
  qr_codes: QrCodeRow[]
}

interface UnitRow {
  id: string
  name: string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export function GarconsClient({
  initialWaiters,
  units,
  defaultUnitId,
}: {
  initialWaiters: WaiterRow[]
  units: UnitRow[]
  defaultUnitId: string | null
}) {
  const supabase = createClient()
  const [waiters, setWaiters] = useState(initialWaiters)
  const [unitId, setUnitId] = useState(defaultUnitId)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<WaiterRow | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [qrTarget, setQrTarget] = useState<{ waiterName: string; token: string } | null>(null)

  async function reload(unit: string | null) {
    if (!unit) return
    const { data } = await supabase
      .from('salao_waiters')
      .select('*, qr_codes:salao_qr_codes(id, token, active, regenerated_at)')
      .eq('unit_id', unit)
      .order('name')
    setWaiters((data as WaiterRow[]) ?? [])
  }

  function openCreate() {
    setEditing(null)
    setName('')
    setPhone('')
    setShowForm(true)
  }

  function openEdit(w: WaiterRow) {
    setEditing(w)
    setName(w.name)
    setPhone(w.phone ?? '')
    setShowForm(true)
  }

  async function handleSave() {
    if (!name.trim() || !unitId) return
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('salao_waiters').update({ name: name.trim(), phone: phone || null }).eq('id', editing.id)
      if (error) toast.error('Erro ao atualizar garçom')
      else toast.success('Garçom atualizado')
    } else {
      const { data: waiter, error } = await supabase
        .from('salao_waiters')
        .insert({ unit_id: unitId, name: name.trim(), phone: phone || null })
        .select('id')
        .single()
      if (error || !waiter) {
        toast.error('Erro ao cadastrar garçom')
      } else {
        const { error: qrError } = await supabase.from('salao_qr_codes').insert({ waiter_id: waiter.id })
        if (qrError) toast.error('Garçom criado, mas houve erro ao gerar o QR Code')
        else toast.success('Garçom cadastrado e QR Code gerado')
      }
    }
    setSaving(false)
    setShowForm(false)
    reload(unitId)
  }

  async function toggleActive(w: WaiterRow) {
    const { error } = await supabase.from('salao_waiters').update({ active: !w.active }).eq('id', w.id)
    if (error) toast.error('Erro ao atualizar status')
    else reload(unitId)
  }

  async function regenerateQr(w: WaiterRow) {
    const qr = w.qr_codes?.[0]
    if (!qr) return
    const { error } = await supabase
      .from('salao_qr_codes')
      .update({ token: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''), regenerated_at: new Date().toISOString() })
      .eq('id', qr.id)
    if (error) toast.error('Erro ao gerar novo QR Code')
    else {
      toast.success('QR Code regenerado — o código anterior deixou de funcionar')
      reload(unitId)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Garçons</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Cadastro e QR Codes individuais de atendimento</p>
        </div>
        <div className="flex items-center gap-2">
          {units.length > 1 && (
            <select
              value={unitId ?? ''}
              onChange={(e) => { setUnitId(e.target.value); reload(e.target.value) }}
              className="input w-auto"
            >
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <button onClick={openCreate} className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2">
            <Plus size={16} /> Novo garçom
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="divide-y divide-surface-border">
          {waiters.map((w) => {
            const qr = w.qr_codes?.[0]
            return (
              <div key={w.id} className="flex items-center gap-3 px-4 py-3.5 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', w.active ? 'text-white' : 'text-neutral-600 line-through')}>{w.name}</p>
                  {w.phone && <p className="text-xs text-neutral-500">{w.phone}</p>}
                </div>
                <button
                  onClick={() => toggleActive(w)}
                  className={cn(
                    'text-xs font-medium px-2.5 py-1 rounded-full border',
                    w.active ? 'text-green-400 border-green-400/30 bg-green-400/10' : 'text-neutral-500 border-surface-border'
                  )}
                >
                  {w.active ? 'Ativo' : 'Inativo'}
                </button>
                {qr && (
                  <button
                    onClick={() => setQrTarget({ waiterName: w.name, token: qr.token })}
                    className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                  >
                    <QrCodeIcon size={13} /> QR Code
                  </button>
                )}
                {qr && (
                  <button onClick={() => regenerateQr(w)} className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5">
                    <RefreshCcw size={13} /> Regenerar
                  </button>
                )}
                <button onClick={() => openEdit(w)} className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5">
                  <Pencil size={13} /> Editar
                </button>
              </div>
            )
          })}
          {waiters.length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-10">Nenhum garçom cadastrado ainda</p>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-white mb-4">{editing ? 'Editar garçom' : 'Novo garçom'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Ex: João Silva" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Telefone (opcional)</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 py-2.5 text-sm">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                {saving && <Loader2 size={15} className="animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {qrTarget && (
        <QrCodeModal
          url={`${APP_URL}/avaliar/${qrTarget.token}`}
          waiterName={qrTarget.waiterName}
          companyName="Matrus"
          onClose={() => setQrTarget(null)}
        />
      )}
    </div>
  )
}
