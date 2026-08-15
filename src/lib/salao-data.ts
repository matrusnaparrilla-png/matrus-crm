import { createClient } from '@/lib/supabase/server'
import type { CategoryGroup, WaiterRanking } from '@/types/salao'

export interface EvaluationRow {
  id: string
  created_at: string
  overall_score: number
  nps_score: number
  return_intent: string
  waiter_id: string | null
  best_aspects: string[]
}

export interface CategoryScoreRow {
  evaluation_id: string
  category_group: CategoryGroup
  category: string
  score: number
}

export async function getEvaluationsInRange(unitId: string, from: Date, to: Date) {
  const supabase = createClient()
  const { data: evaluations } = await supabase
    .from('salao_evaluations')
    .select('id, created_at, overall_score, nps_score, return_intent, waiter_id, best_aspects')
    .eq('unit_id', unitId)
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .order('created_at', { ascending: false })

  const evals = (evaluations ?? []) as EvaluationRow[]
  const ids = evals.map((e) => e.id)

  let categories: CategoryScoreRow[] = []
  if (ids.length > 0) {
    const { data } = await supabase
      .from('salao_evaluation_categories')
      .select('evaluation_id, category_group, category, score')
      .in('evaluation_id', ids)
    categories = (data ?? []) as CategoryScoreRow[]
  }

  return { evaluations: evals, categories }
}

export async function getWaiterRanking(unitId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('vw_salao_waiter_ranking')
    .select('*')
    .eq('unit_id', unitId)
    .order('avg_overall', { ascending: false })
  return (data ?? []) as WaiterRanking[]
}

export async function getMinEvaluationsThreshold() {
  const supabase = createClient()
  const { data } = await supabase.from('salao_settings').select('value').eq('key', 'min_evaluations_for_ranking').single()
  return typeof data?.value === 'number' ? data.value : 5
}

export function avg(nums: number[]): number | null {
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

export function categoryAverages(categories: CategoryScoreRow[], group: CategoryGroup) {
  const filtered = categories.filter((c) => c.category_group === group)
  const byCategory = new Map<string, number[]>()
  for (const c of filtered) {
    const arr = byCategory.get(c.category) ?? []
    arr.push(c.score)
    byCategory.set(c.category, arr)
  }
  return Array.from(byCategory.entries()).map(([category, scores]) => ({
    category,
    avg: avg(scores)!,
    count: scores.length,
  }))
}

export function computeNps(evaluations: EvaluationRow[]): number | null {
  if (evaluations.length === 0) return null
  const promoters = evaluations.filter((e) => e.nps_score >= 9).length
  const detractors = evaluations.filter((e) => e.nps_score <= 6).length
  return Math.round(((promoters - detractors) / evaluations.length) * 1000) / 10
}
