import { requireSalaoUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getEvaluationsInRange, getWaiterRanking, getMinEvaluationsThreshold, avg, categoryAverages, computeNps } from '@/lib/salao-data'
import { buildInsights, buildRecommendations } from '@/lib/insights'
import { resolvePeriod, type PeriodKey } from '@/lib/period'
import { DashboardClient } from './DashboardClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard · Matrus' }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { period?: string; from?: string; to?: string }
}) {
  const profile = await requireSalaoUser()
  const supabase = createClient()

  let unitId = profile.unit_id
  if (!unitId) {
    const { data: firstUnit } = await supabase.from('salao_units').select('id').eq('active', true).limit(1).single()
    unitId = firstUnit?.id ?? null
  }

  const period = (searchParams.period as PeriodKey) ?? '30d'
  const { from, to } = resolvePeriod(period, searchParams.from, searchParams.to)

  if (!unitId) {
    return <p className="text-sm text-neutral-500">Nenhuma unidade cadastrada ainda.</p>
  }

  const [{ evaluations, categories }, ranking, minThreshold] = await Promise.all([
    getEvaluationsInRange(unitId, from, to),
    profile.role !== 'garcom' ? getWaiterRanking(unitId) : Promise.resolve([]),
    getMinEvaluationsThreshold(),
  ])

  let alerts: { id: string; type: string; status: string; reason: string; created_at: string; evaluation_id: string }[] = []
  if (profile.role !== 'garcom') {
    const { data } = await supabase
      .from('salao_alerts')
      .select('id, type, status, reason, created_at, evaluation_id')
      .order('created_at', { ascending: false })
      .limit(500)
    alerts = data ?? []
  }

  const kpis = {
    total: evaluations.length,
    avgOverall: avg(evaluations.map((e) => e.overall_score)),
    nps: computeNps(evaluations),
    likelyToReturn: evaluations.length
      ? Math.round((evaluations.filter((e) => e.return_intent === 'certamente' || e.return_intent === 'provavelmente').length / evaluations.length) * 1000) / 10
      : null,
  }

  const categoryBreakdown = {
    atendimento: categoryAverages(categories, 'atendimento'),
    comida: categoryAverages(categories, 'comida'),
    ambiente: categoryAverages(categories, 'ambiente'),
    operacao: categoryAverages(categories, 'operacao'),
  }

  const insights = buildInsights(evaluations, categories)
  const recommendations = buildRecommendations(evaluations, categories)

  return (
    <DashboardClient
      profile={profile}
      period={period}
      customFrom={searchParams.from}
      customTo={searchParams.to}
      kpis={kpis}
      ranking={ranking}
      minThreshold={minThreshold}
      categoryBreakdown={categoryBreakdown}
      alerts={alerts}
      insights={insights}
      recommendations={recommendations}
      evaluations={evaluations}
    />
  )
}
