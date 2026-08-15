'use client'

import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { PERIOD_LABELS, type PeriodKey } from '@/lib/period'
import { CATEGORY_GROUP_LABELS, CATEGORY_CATALOG, type CategoryGroup, type SalaoUser } from '@/types/salao'
import { formatDateTime, cn } from '@/lib/utils'
import { Star, TrendingUp, Users, AlertTriangle, Trophy, Lightbulb, ListChecks } from 'lucide-react'
import Link from 'next/link'

interface Props {
  profile: SalaoUser
  period: PeriodKey
  customFrom?: string
  customTo?: string
  kpis: { total: number; avgOverall: number | null; nps: number | null; likelyToReturn: number | null }
  ranking: {
    waiter_id: string; name: string; total_evaluations: number; avg_overall: number | null
    nps: number | null; five_star_pct: number | null; complaint_count: number
  }[]
  minThreshold: number
  categoryBreakdown: Record<CategoryGroup, { category: string; avg: number; count: number }[]>
  alerts: { id: string; type: string; status: string; reason: string; created_at: string; evaluation_id: string }[]
  insights: { text: string }[]
  recommendations: { problema: string; causaProvavel: string; prioridade: string; recomendacao: string; impactoEsperado: string }[]
  evaluations: { id: string }[]
}

export function DashboardClient({
  profile, period, customFrom, customTo, kpis, ranking, minThreshold, categoryBreakdown, alerts, insights, recommendations,
}: Props) {
  const router = useRouter()
  const isStaffAdmin = profile.role !== 'garcom'

  function setPeriod(p: PeriodKey) {
    const params = new URLSearchParams({ period: p })
    router.push(`/admin?${params.toString()}`)
  }

  const groupAvgData = (Object.keys(CATEGORY_GROUP_LABELS) as CategoryGroup[]).map((g) => {
    const rows = categoryBreakdown[g]
    const total = rows.reduce((a, r) => a + r.avg * r.count, 0)
    const count = rows.reduce((a, r) => a + r.count, 0)
    return { group: CATEGORY_GROUP_LABELS[g], avg: count ? Math.round((total / count) * 100) / 100 : 0 }
  })

  const openAlerts = alerts.filter((a) => a.type === 'negativo' && (a.status === 'novo' || a.status === 'em_analise'))
  const positiveHighlights = alerts.filter((a) => a.type === 'positivo').slice(0, 5)
  const eligibleRanking = ranking.filter((r) => r.total_evaluations >= minThreshold)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">{isStaffAdmin ? 'Dashboard' : 'Meus indicadores'}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {isStaffAdmin ? 'Experiência do cliente no salão' : 'Seu desempenho de atendimento'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).filter((p) => p !== 'personalizado').map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                period === p ? 'bg-brand-500/15 border-brand-500 text-brand-400' : 'border-surface-border text-neutral-400'
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Star} label="Avaliações" value={kpis.total.toString()} />
        <KpiCard icon={TrendingUp} label="Nota média" value={kpis.avgOverall?.toFixed(1) ?? '—'} />
        <KpiCard icon={Users} label="NPS" value={kpis.nps !== null ? kpis.nps.toFixed(0) : '—'} />
        {isStaffAdmin ? (
          <KpiCard icon={AlertTriangle} label="Alertas abertos" value={openAlerts.length.toString()} accent={openAlerts.length > 0 ? 'warn' : undefined} />
        ) : (
          <KpiCard icon={Users} label="Intenção de retorno" value={kpis.likelyToReturn !== null ? `${kpis.likelyToReturn}%` : '—'} />
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Notas por categoria</h2>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={groupAvgData} layout="vertical" margin={{ left: 0, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
              <XAxis type="number" domain={[0, 5]} tick={{ fill: '#737373', fontSize: 11 }} stroke="#404040" />
              <YAxis type="category" dataKey="group" width={90} tick={{ fill: '#a3a3a3', fontSize: 12 }} stroke="#404040" />
              <Tooltip contentStyle={{ background: '#161616', border: '1px solid #262626', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="avg" fill="#f97316" radius={[0, 6, 6, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {isStaffAdmin && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-surface-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Trophy size={16} className="text-yellow-400" /> Ranking de garçons</h2>
            <Link href="/admin/garcons" className="text-xs text-brand-400">Gerenciar</Link>
          </div>
          <div className="divide-y divide-surface-border">
            {eligibleRanking.map((r, i) => (
              <div key={r.waiter_id} className="flex items-center gap-3 px-4 py-3">
                <span className={cn('text-sm w-7 text-center shrink-0', i < 3 ? 'text-yellow-400 font-bold' : 'text-neutral-500')}>{i + 1}º</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{r.name}</p>
                  <p className="text-xs text-neutral-500">{r.total_evaluations} avaliações · NPS {r.nps?.toFixed(0) ?? '—'} · {r.complaint_count} reclamações</p>
                </div>
                <span className="text-sm font-semibold text-brand-400 shrink-0">{r.avg_overall?.toFixed(1) ?? '—'}</span>
              </div>
            ))}
            {ranking.filter((r) => r.total_evaluations > 0 && r.total_evaluations < minThreshold).map((r) => (
              <div key={r.waiter_id} className="flex items-center gap-3 px-4 py-3 opacity-60">
                <span className="text-sm w-7 text-center shrink-0 text-neutral-600">—</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{r.name}</p>
                  <p className="text-xs text-neutral-500">{r.total_evaluations} avaliações (mín. {minThreshold} para ranking)</p>
                </div>
                <span className="text-xs text-neutral-600">Dados insuficientes</span>
              </div>
            ))}
            {ranking.length === 0 && <p className="text-sm text-neutral-500 text-center py-8">Nenhum dado ainda</p>}
          </div>
        </div>
      )}

      {isStaffAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-surface-border">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2"><AlertTriangle size={16} className="text-red-400" /> Precisa de atenção</h2>
            </div>
            <div className="divide-y divide-surface-border max-h-80 overflow-y-auto">
              {openAlerts.slice(0, 8).map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <p className="text-sm text-white">{a.reason}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{formatDateTime(a.created_at)}</p>
                </div>
              ))}
              {openAlerts.length === 0 && <p className="text-sm text-neutral-500 text-center py-8">Nenhum alerta aberto 🎉</p>}
            </div>
            <div className="p-3 border-t border-surface-border">
              <Link href="/admin/alertas" className="text-xs text-brand-400">Ver todos os alertas</Link>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-surface-border">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Star size={16} className="text-green-400 fill-green-400" /> Destaques da equipe</h2>
            </div>
            <div className="divide-y divide-surface-border max-h-80 overflow-y-auto">
              {positiveHighlights.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <p className="text-sm text-white">{a.reason}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{formatDateTime(a.created_at)}</p>
                </div>
              ))}
              {positiveHighlights.length === 0 && <p className="text-sm text-neutral-500 text-center py-8">Ainda sem destaques no período</p>}
            </div>
          </div>
        </div>
      )}

      {isStaffAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Lightbulb size={16} className="text-brand-400" /> O que está acontecendo?</h2>
            <ul className="space-y-2.5">
              {insights.map((ins, i) => (
                <li key={i} className="text-sm text-neutral-300 flex gap-2">
                  <span className="text-brand-400 mt-0.5">•</span> {ins.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><ListChecks size={16} className="text-brand-400" /> O que devemos fazer?</h2>
            {recommendations.length === 0 ? (
              <p className="text-sm text-neutral-500">Dados insuficientes para concluir.</p>
            ) : (
              <div className="space-y-4">
                {recommendations.map((r, i) => (
                  <div key={i} className="pb-4 border-b border-surface-border last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                        r.prioridade === 'Alta' ? 'bg-red-400/10 text-red-400' : r.prioridade === 'Média' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-neutral-400/10 text-neutral-400'
                      )}>
                        {r.prioridade.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-white font-medium">{r.problema}</p>
                    <p className="text-xs text-neutral-500 mt-1">Causa provável: {r.causaProvavel}</p>
                    <p className="text-xs text-neutral-300 mt-1">Recomendação: {r.recomendacao}</p>
                    <p className="text-xs text-neutral-500 mt-1">Impacto esperado: {r.impactoEsperado}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: typeof Star; label: string; value: string; accent?: 'warn' }) {
  return (
    <div className="card p-4">
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center mb-3',
        accent === 'warn' ? 'bg-red-400/10' : 'bg-brand-500/10'
      )}>
        <Icon size={16} className={accent === 'warn' ? 'text-red-400' : 'text-brand-400'} />
      </div>
      <p className="text-xs text-neutral-500 mb-0.5">{label}</p>
      <p className="text-xl font-semibold text-white">{value}</p>
    </div>
  )
}
