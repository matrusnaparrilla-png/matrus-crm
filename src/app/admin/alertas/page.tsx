import { requireSalaoUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AlertasClient } from './AlertasClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Alertas · Matrus' }

export default async function AlertasPage() {
  const profile = await requireSalaoUser(['admin', 'gerente'])
  const supabase = createClient()

  const { data: alerts } = await supabase
    .from('salao_alerts')
    .select(`
      id, type, status, reason, internal_note, created_at, resolved_at,
      evaluation:salao_evaluations(
        id, overall_score, nps_score, return_intent, comment, food_comment, ambience_comment,
        client_name, client_phone, created_at,
        waiter:salao_waiters(id, name),
        table:salao_tables(id, number)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(300)

  return <AlertasClient initialAlerts={(alerts ?? []) as unknown as AlertRow[]} profileId={profile.id} />
}

export interface AlertRow {
  id: string
  type: 'negativo' | 'positivo'
  status: 'novo' | 'em_analise' | 'resolvido' | 'ignorado'
  reason: string
  internal_note: string | null
  created_at: string
  resolved_at: string | null
  evaluation: {
    id: string
    overall_score: number
    nps_score: number
    return_intent: string
    comment: string | null
    food_comment: string | null
    ambience_comment: string | null
    client_name: string | null
    client_phone: string | null
    created_at: string
    waiter: { id: string; name: string } | null
    table: { id: string; number: number } | null
  } | null
}
