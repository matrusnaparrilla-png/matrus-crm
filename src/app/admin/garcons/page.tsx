import { requireSalaoUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { GarconsClient } from './GarconsClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Garçons · Matrus' }

export default async function GarconsPage() {
  const profile = await requireSalaoUser(['admin', 'gerente'])
  const supabase = createClient()

  const { data: units } = await supabase.from('salao_units').select('*').eq('active', true).order('name')
  const defaultUnitId = profile.unit_id ?? units?.[0]?.id ?? null

  const { data: waiters } = await supabase
    .from('salao_waiters')
    .select('*, qr_codes:salao_qr_codes(id, token, active, regenerated_at)')
    .eq('unit_id', defaultUnitId)
    .order('name')

  return (
    <GarconsClient
      initialWaiters={waiters ?? []}
      units={units ?? []}
      defaultUnitId={defaultUnitId}
    />
  )
}
