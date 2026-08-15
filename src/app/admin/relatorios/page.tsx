import { requireSalaoUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getEvaluationsInRange, getWaiterRanking, avg, categoryAverages } from '@/lib/salao-data'
import { resolvePeriod } from '@/lib/period'
import { CATEGORY_CATALOG, BEST_ASPECT_OPTIONS, type CategoryGroup } from '@/types/salao'
import { RelatoriosClient } from './RelatoriosClient'
import type { Metadata } from 'next'
import { startOfMonth, endOfDay } from 'date-fns'

export const metadata: Metadata = { title: 'Relatórios · Matrus' }

export default async function RelatoriosPage() {
  const profile = await requireSalaoUser(['admin', 'gerente'])
  const supabase = createClient()

  let unitId = profile.unit_id
  if (!unitId) {
    const { data: firstUnit } = await supabase.from('salao_units').select('id').eq('active', true).limit(1).single()
    unitId = firstUnit?.id ?? null
  }

  const { data: waiters } = await supabase.from('salao_waiters').select('id, name').eq('unit_id', unitId ?? '').order('name')
  const { data: tables } = await supabase.from('salao_tables').select('id, number').eq('unit_id', unitId ?? '').order('number')

  const now = new Date()
  const { evaluations, categories } = unitId
    ? await getEvaluationsInRange(unitId, startOfMonth(now), endOfDay(now))
    : { evaluations: [], categories: [] }
  const ranking = unitId ? await getWaiterRanking(unitId) : []

  const bestWaiter = [...ranking].filter((r) => r.total_evaluations > 0).sort((a, b) => (b.avg_overall ?? 0) - (a.avg_overall ?? 0))[0] ?? null

  const aspectCounts = new Map<string, number>()
  for (const e of evaluations) for (const a of e.best_aspects) aspectCounts.set(a, (aspectCounts.get(a) ?? 0) + 1)
  const topAspect = Array.from(aspectCounts.entries()).sort((a, b) => b[1] - a[1])[0]
  const topAspectLabel = topAspect ? BEST_ASPECT_OPTIONS.find((o) => o.value === topAspect[0])?.label ?? topAspect[0] : null

  const allGroupCats = (Object.keys(CATEGORY_CATALOG) as CategoryGroup[]).flatMap((g) => categoryAverages(categories, g).map((c) => ({ ...c, group: g })))
  const worstCategory = [...allGroupCats].sort((a, b) => a.avg - b.avg)[0] ?? null
  const worstLabel = worstCategory ? CATEGORY_CATALOG[worstCategory.group].find((c) => c.key === worstCategory.category)?.label ?? worstCategory.category : null

  const byHour = new Map<number, number[]>()
  for (const e of evaluations) {
    const h = new Date(e.created_at).getHours()
    byHour.set(h, [...(byHour.get(h) ?? []), e.overall_score])
  }
  const hourStats = Array.from(byHour.entries()).filter(([, s]) => s.length >= 2).map(([h, s]) => ({ h, avg: avg(s)! }))
  const worstHour = hourStats.sort((a, b) => a.avg - b.avg)[0] ?? null

  const monthlyReport = {
    period: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    total: evaluations.length,
    avgOverall: avg(evaluations.map((e) => e.overall_score)),
    bestWaiterName: bestWaiter?.name ?? null,
    topAspectLabel,
    worstCategoryLabel: worstLabel,
    worstHour: worstHour ? `${worstHour.h}h–${worstHour.h + 1}h` : null,
  }

  return (
    <RelatoriosClient
      unitId={unitId}
      waiters={waiters ?? []}
      tables={tables ?? []}
      monthlyReport={monthlyReport}
    />
  )
}
