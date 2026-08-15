'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PERIOD_LABELS, resolvePeriod, type PeriodKey } from '@/lib/period'
import { RETURN_INTENT_LABELS, type ReturnIntent } from '@/types/salao'
import { toCsv, downloadCsv } from '@/lib/csv'
import { formatDateTime, cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Download, Search, Loader2, FileText } from 'lucide-react'

interface ResultRow {
  id: string
  created_at: string
  overall_score: number
  nps_score: number
  return_intent: string
  comment: string | null
  client_name: string | null
  client_phone: string | null
  waiter: { name: string } | null
  table: { number: number } | null
}

export function RelatoriosClient({
  unitId, waiters, tables, monthlyReport,
}: {
  unitId: string | null
  waiters: { id: string; name: string }[]
  tables: { id: string; number: number }[]
  monthlyReport: {
    period: string; total: number; avgOverall: number | null; bestWaiterName: string | null
    topAspectLabel: string | null; worstCategoryLabel: string | null; worstHour: string | null
  }
}) {
  const supabase = createClient()
  const [period, setPeriod] = useState<PeriodKey>('30d')
  const [waiterId, setWaiterId] = useState('')
  const [tableId, setTableId] = useState('')
  const [minScore, setMinScore] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ResultRow[]>([])
  const [searched, setSearched] = useState(false)

  async function runSearch() {
    if (!unitId) return
    setLoading(true)
    const { from, to } = resolvePeriod(period)
    let query = supabase
      .from('salao_evaluations')
      .select('id, created_at, overall_score, nps_score, return_intent, comment, client_name, client_phone, waiter:salao_waiters(name), table:salao_tables(number)')
      .eq('unit_id', unitId)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .order('created_at', { ascending: false })
      .limit(2000)

    if (waiterId) query = query.eq('waiter_id', waiterId)
    if (tableId) query = query.eq('table_id', tableId)
    if (minScore) query = query.lte('overall_score', Number(minScore))

    const { data, error } = await query
    setLoading(false)
    setSearched(true)
    if (error) {
      toast.error('Erro ao buscar avaliações')
      return
    }
    setResults((data as unknown as ResultRow[]) ?? [])
  }

  function exportCsv() {
    if (results.length === 0) return
    const rows = results.map((r) => ({
      data: formatDateTime(r.created_at),
      garcom: r.waiter?.name ?? '',
      mesa: r.table?.number ?? '',
      nota_geral: r.overall_score,
      nps: r.nps_score,
      intencao_retorno: RETURN_INTENT_LABELS[r.return_intent as ReturnIntent] ?? r.return_intent,
      comentario: r.comment ?? '',
      cliente: r.client_name ?? '',
      telefone: r.client_phone ?? '',
    }))
    downloadCsv(`avaliacoes-matrus-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-white">Relatórios</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Exportação de dados e resumo mensal</p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <FileText size={16} className="text-brand-400" /> Relatório de experiência — {monthlyReport.period}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <Stat label="Avaliações" value={monthlyReport.total.toString()} />
          <Stat label="Nota média" value={monthlyReport.avgOverall?.toFixed(2) ?? '—'} />
          <Stat label="Melhor garçom" value={monthlyReport.bestWaiterName ?? 'Dados insuficientes'} />
          <Stat label="Maior ponto positivo" value={monthlyReport.topAspectLabel ?? 'Dados insuficientes'} />
          <Stat label="Maior problema" value={monthlyReport.worstCategoryLabel ?? 'Dados insuficientes'} />
          <Stat label="Horário crítico" value={monthlyReport.worstHour ?? 'Dados insuficientes'} />
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Filtros</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodKey)} className="input">
            {(Object.keys(PERIOD_LABELS) as PeriodKey[]).filter((p) => p !== 'personalizado').map((p) => (
              <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
            ))}
          </select>
          <select value={waiterId} onChange={(e) => setWaiterId(e.target.value)} className="input">
            <option value="">Todos os garçons</option>
            {waiters.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={tableId} onChange={(e) => setTableId(e.target.value)} className="input">
            <option value="">Todas as mesas</option>
            {tables.map((t) => <option key={t.id} value={t.id}>Mesa {t.number}</option>)}
          </select>
          <select value={minScore} onChange={(e) => setMinScore(e.target.value)} className="input">
            <option value="">Qualquer nota</option>
            <option value="1">Nota ≤ 1</option>
            <option value="2">Nota ≤ 2</option>
            <option value="3">Nota ≤ 3</option>
            <option value="4">Nota ≤ 4</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={runSearch} disabled={loading} className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
          </button>
          <button onClick={exportCsv} disabled={results.length === 0} className="btn-secondary px-4 py-2.5 text-sm flex items-center gap-2">
            <Download size={15} /> Exportar CSV
          </button>
        </div>
      </div>

      {searched && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-surface-border">
            <p className="text-sm text-neutral-400">{results.length} avaliações encontradas</p>
          </div>
          <div className="divide-y divide-surface-border max-h-96 overflow-y-auto">
            {results.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{r.waiter?.name ?? '—'} {r.table ? `· Mesa ${r.table.number}` : ''}</p>
                  <p className="text-xs text-neutral-500">{formatDateTime(r.created_at)}</p>
                </div>
                <span className={cn('text-sm font-semibold', r.overall_score <= 3 ? 'text-red-400' : 'text-green-400')}>{r.overall_score}</span>
              </div>
            ))}
            {results.length === 0 && <p className="text-sm text-neutral-500 text-center py-8">Nenhum resultado para os filtros selecionados</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500 mb-0.5">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  )
}
