import type { EvaluationRow, CategoryScoreRow } from '@/lib/salao-data'
import { avg, categoryAverages } from '@/lib/salao-data'
import type { CategoryGroup } from '@/types/salao'

const MIN_SAMPLE = 8
const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export interface Insight {
  text: string
}

export interface Recommendation {
  problema: string
  causaProvavel: string
  prioridade: 'Alta' | 'Média' | 'Baixa'
  recomendacao: string
  impactoEsperado: string
}

export function buildInsights(evaluations: EvaluationRow[], categories: CategoryScoreRow[]): Insight[] {
  const insights: Insight[] = []
  if (evaluations.length < MIN_SAMPLE) {
    return [{ text: 'Dados insuficientes para concluir. Colete mais avaliações para gerar análises confiáveis.' }]
  }

  const groupAverages: Record<CategoryGroup, number | null> = {
    atendimento: avg(categories.filter((c) => c.category_group === 'atendimento').map((c) => c.score)),
    comida: avg(categories.filter((c) => c.category_group === 'comida').map((c) => c.score)),
    ambiente: avg(categories.filter((c) => c.category_group === 'ambiente').map((c) => c.score)),
    operacao: avg(categories.filter((c) => c.category_group === 'operacao').map((c) => c.score)),
  }

  const groupLabels: Record<CategoryGroup, string> = {
    atendimento: 'atendimento', comida: 'comida', ambiente: 'ambiente', operacao: 'tempo de espera/operação',
  }

  const validGroups = (Object.entries(groupAverages) as [CategoryGroup, number | null][]).filter(([, v]) => v !== null) as [CategoryGroup, number][]
  if (validGroups.length >= 2) {
    const sorted = [...validGroups].sort((a, b) => a[1] - b[1])
    const [worstGroup, worstAvg] = sorted[0]
    const [bestGroup, bestAvg] = sorted[sorted.length - 1]
    if (bestAvg - worstAvg >= 0.5) {
      insights.push({
        text: `${capitalize(groupLabels[bestGroup])} recebe boas notas (${bestAvg.toFixed(1)}), mas ${groupLabels[worstGroup]} está prejudicando a experiência (${worstAvg.toFixed(1)}).`,
      })
    }
  }

  const byWeekday = new Map<number, number[]>()
  for (const e of evaluations) {
    const day = new Date(e.created_at).getDay()
    const arr = byWeekday.get(day) ?? []
    arr.push(e.overall_score)
    byWeekday.set(day, arr)
  }
  if (byWeekday.size >= 3) {
    const weekdayAvgs = Array.from(byWeekday.entries())
      .filter(([, scores]) => scores.length >= 3)
      .map(([day, scores]) => ({ day, avg: avg(scores)!, count: scores.length }))
    if (weekdayAvgs.length >= 2) {
      const sorted = [...weekdayAvgs].sort((a, b) => a.avg - b.avg)
      const worst = sorted[0]
      const best = sorted[sorted.length - 1]
      if (best.avg - worst.avg >= 0.4) {
        insights.push({
          text: `${WEEKDAY_LABELS[worst.day]} apresenta o pior desempenho médio (${worst.avg.toFixed(1)}), enquanto ${WEEKDAY_LABELS[best.day]} tem o melhor (${best.avg.toFixed(1)}).`,
        })
      }
    }
  }

  const byHour = new Map<number, number[]>()
  for (const e of evaluations) {
    const hour = new Date(e.created_at).getHours()
    const arr = byHour.get(hour) ?? []
    arr.push(e.overall_score)
    byHour.set(hour, arr)
  }
  const hourAvgs = Array.from(byHour.entries())
    .filter(([, scores]) => scores.length >= 3)
    .map(([hour, scores]) => ({ hour, avg: avg(scores)!, count: scores.length }))
  if (hourAvgs.length >= 2) {
    const worstHour = [...hourAvgs].sort((a, b) => a.avg - b.avg)[0]
    if (worstHour.avg <= 3.5) {
      insights.push({
        text: `O horário das ${worstHour.hour}h–${worstHour.hour + 1}h concentra a maior incidência de avaliações negativas (nota média ${worstHour.avg.toFixed(1)}).`,
      })
    }
  }

  const highReturnIntent = evaluations.filter((e) => e.return_intent === 'certamente' || e.return_intent === 'provavelmente')
  if (highReturnIntent.length >= MIN_SAMPLE) {
    const avgScoreReturners = avg(highReturnIntent.map((e) => e.overall_score))
    const others = evaluations.filter((e) => !highReturnIntent.includes(e))
    const avgScoreOthers = avg(others.map((e) => e.overall_score))
    if (avgScoreReturners !== null && avgScoreOthers !== null && avgScoreReturners - avgScoreOthers >= 0.5) {
      insights.push({
        text: `Clientes com alta intenção de retorno avaliaram a experiência geral com nota média ${avgScoreReturners.toFixed(1)}, contra ${avgScoreOthers.toFixed(1)} entre os demais.`,
      })
    }
  }

  const negativePct = Math.round((evaluations.filter((e) => e.overall_score <= 3).length / evaluations.length) * 1000) / 10
  if (negativePct > 0) {
    insights.push({ text: `${negativePct}% das avaliações do período tiveram nota geral igual ou abaixo de 3.` })
  }

  if (insights.length === 0) {
    insights.push({ text: 'Os indicadores do período estão estáveis, sem padrões negativos relevantes identificados.' })
  }

  return insights
}

export function buildRecommendations(evaluations: EvaluationRow[], categories: CategoryScoreRow[]): Recommendation[] {
  if (evaluations.length < MIN_SAMPLE) return []
  const recs: Recommendation[] = []

  const opAvg = avg(categoryAverages(categories, 'operacao').flatMap((c) => Array(c.count).fill(c.avg)))
  if (opAvg !== null && opAvg <= 3.5) {
    recs.push({
      problema: 'Tempo de espera e agilidade operacional abaixo do esperado.',
      causaProvavel: 'Possível gargalo na cozinha ou dimensionamento insuficiente da equipe em horários de pico.',
      prioridade: 'Alta',
      recomendacao: 'Reforçar a equipe de salão e cozinha nos horários de maior movimento e revisar o fluxo de preparo dos pratos mais pedidos.',
      impactoEsperado: 'Redução de detratores e melhoria da experiência geral percebida.',
    })
  }

  const negativePct = evaluations.filter((e) => e.overall_score <= 3).length / evaluations.length
  const badReturn = evaluations.filter((e) => e.return_intent === 'provavelmente_nao' || e.return_intent === 'nao_voltaria').length / evaluations.length
  if (negativePct >= 0.15 || badReturn >= 0.15) {
    recs.push({
      problema: 'Parcela relevante dos clientes com experiência insatisfatória ou baixa intenção de retorno.',
      causaProvavel: 'Padrão recorrente em uma ou mais categorias avaliadas — verificar detalhes por categoria e comentários.',
      prioridade: 'Alta',
      recomendacao: 'Revisar os comentários das avaliações negativas mais recentes na seção de Alertas e priorizar o acompanhamento individual.',
      impactoEsperado: 'Redução da taxa de reclamação e aumento do NPS.',
    })
  }

  const ambienceAvg = avg(categoryAverages(categories, 'ambiente').flatMap((c) => Array(c.count).fill(c.avg)))
  if (ambienceAvg !== null && ambienceAvg <= 3.5) {
    recs.push({
      problema: 'Ambiente avaliado abaixo do esperado pelos clientes.',
      causaProvavel: 'Possíveis pontos de limpeza, conforto ou organização do salão.',
      prioridade: 'Média',
      recomendacao: 'Realizar checklist de padrão de ambiente (limpeza, organização, conforto) em horários de pico.',
      impactoEsperado: 'Melhoria da nota de ambiente e da experiência geral.',
    })
  }

  return recs
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
