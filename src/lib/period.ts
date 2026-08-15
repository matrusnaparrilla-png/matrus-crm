import {
  startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths,
} from 'date-fns'

export type PeriodKey = 'hoje' | 'ontem' | '7d' | '30d' | 'mes_atual' | 'mes_anterior' | 'personalizado'

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  mes_atual: 'Este mês',
  mes_anterior: 'Mês anterior',
  personalizado: 'Personalizado',
}

export function resolvePeriod(period: PeriodKey, customFrom?: string, customTo?: string) {
  const now = new Date()
  switch (period) {
    case 'hoje':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'ontem': {
      const y = subDays(now, 1)
      return { from: startOfDay(y), to: endOfDay(y) }
    }
    case '7d':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) }
    case '30d':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) }
    case 'mes_atual':
      return { from: startOfMonth(now), to: endOfDay(now) }
    case 'mes_anterior': {
      const prev = subMonths(now, 1)
      return { from: startOfMonth(prev), to: endOfMonth(prev) }
    }
    case 'personalizado':
      return {
        from: customFrom ? startOfDay(new Date(customFrom)) : startOfDay(subDays(now, 29)),
        to: customTo ? endOfDay(new Date(customTo)) : endOfDay(now),
      }
    default:
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) }
  }
}
