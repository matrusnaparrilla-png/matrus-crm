'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime, cn } from '@/lib/utils'
import { RETURN_INTENT_LABELS, type ReturnIntent } from '@/types/salao'
import toast from 'react-hot-toast'
import { ChevronDown, User, Table2 } from 'lucide-react'
import type { AlertRow } from './page'

const STATUS_LABELS: Record<AlertRow['status'], string> = {
  novo: 'Novo', em_analise: 'Em análise', resolvido: 'Resolvido', ignorado: 'Ignorado',
}
const STATUS_COLORS: Record<AlertRow['status'], string> = {
  novo: 'bg-red-400/10 text-red-400 border-red-400/30',
  em_analise: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30',
  resolvido: 'bg-green-400/10 text-green-400 border-green-400/30',
  ignorado: 'bg-neutral-500/10 text-neutral-500 border-neutral-500/30',
}

export function AlertasClient({ initialAlerts, profileId }: { initialAlerts: AlertRow[]; profileId: string }) {
  const supabase = createClient()
  const [alerts, setAlerts] = useState(initialAlerts)
  const [tab, setTab] = useState<'negativo' | 'positivo'>('negativo')
  const [statusFilter, setStatusFilter] = useState<AlertRow['status'] | 'todos'>('todos')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const filtered = useMemo(() => {
    return alerts.filter((a) => a.type === tab && (statusFilter === 'todos' || a.status === statusFilter))
  }, [alerts, tab, statusFilter])

  async function updateStatus(alert: AlertRow, status: AlertRow['status'], note?: string) {
    const patch: Record<string, unknown> = { status }
    if (note !== undefined) patch.internal_note = note
    if (status === 'resolvido') {
      patch.resolved_at = new Date().toISOString()
      patch.resolved_by = profileId
    }
    const { error } = await supabase.from('salao_alerts').update(patch).eq('id', alert.id)
    if (error) {
      toast.error('Erro ao atualizar alerta')
      return
    }
    setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, ...patch } as AlertRow : a)))
    toast.success('Alerta atualizado')
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-white">Alertas</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Experiências que precisam de atenção e destaques da equipe</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5">
          <button onClick={() => setTab('negativo')} className={cn('px-3.5 py-2 rounded-lg text-sm font-medium border', tab === 'negativo' ? 'bg-red-400/10 border-red-400/30 text-red-400' : 'border-surface-border text-neutral-400')}>
            Precisa de atenção
          </button>
          <button onClick={() => setTab('positivo')} className={cn('px-3.5 py-2 rounded-lg text-sm font-medium border', tab === 'positivo' ? 'bg-green-400/10 border-green-400/30 text-green-400' : 'border-surface-border text-neutral-400')}>
            Destaques
          </button>
        </div>
        {tab === 'negativo' && (
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="input w-auto">
            <option value="todos">Todos os status</option>
            <option value="novo">Novo</option>
            <option value="em_analise">Em análise</option>
            <option value="resolvido">Resolvido</option>
            <option value="ignorado">Ignorado</option>
          </select>
        )}
      </div>

      <div className="card divide-y divide-surface-border overflow-hidden">
        {filtered.map((a) => {
          const isOpen = expanded === a.id
          const ev = a.evaluation
          return (
            <div key={a.id}>
              <button
                onClick={() => { setExpanded(isOpen ? null : a.id); setNoteDraft(a.internal_note ?? '') }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{a.reason}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500 flex-wrap">
                    {ev?.waiter && <span className="flex items-center gap-1"><User size={11} /> {ev.waiter.name}</span>}
                    {ev?.table && <span className="flex items-center gap-1"><Table2 size={11} /> Mesa {ev.table.number}</span>}
                    <span>{formatDateTime(a.created_at)}</span>
                    <span>Nota {ev?.overall_score ?? '—'}</span>
                  </div>
                </div>
                {tab === 'negativo' && (
                  <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0', STATUS_COLORS[a.status])}>
                    {STATUS_LABELS[a.status]}
                  </span>
                )}
                <ChevronDown size={16} className={cn('text-neutral-500 shrink-0 transition-transform', isOpen && 'rotate-180')} />
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3 bg-surface-hover/30">
                  <div className="text-xs text-neutral-400 space-y-1">
                    <p><strong className="text-neutral-300">Cliente:</strong> {ev?.client_name || 'Anônimo'}{ev?.client_phone ? ` · ${ev.client_phone}` : ''}</p>
                    <p><strong className="text-neutral-300">Intenção de retorno:</strong> {ev ? RETURN_INTENT_LABELS[ev.return_intent as ReturnIntent] : '—'}</p>
                    <p><strong className="text-neutral-300">NPS:</strong> {ev?.nps_score ?? '—'}</p>
                    {ev?.comment && <p><strong className="text-neutral-300">Como conheceu:</strong> {ev.comment}</p>}
                    {ev?.food_comment && <p><strong className="text-neutral-300">Comentário (comida):</strong> &ldquo;{ev.food_comment}&rdquo;</p>}
                    {ev?.ambience_comment && <p><strong className="text-neutral-300">Comentário (ambiente):</strong> &ldquo;{ev.ambience_comment}&rdquo;</p>}
                  </div>

                  {tab === 'negativo' && (
                    <>
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Observação interna"
                        className="input min-h-16 resize-none text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        {(['novo', 'em_analise', 'resolvido', 'ignorado'] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStatus(a, s, noteDraft)}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                              a.status === s ? STATUS_COLORS[s] : 'border-surface-border text-neutral-400'
                            )}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && <p className="text-sm text-neutral-500 text-center py-10">Nenhum registro encontrado</p>}
      </div>
    </div>
  )
}
