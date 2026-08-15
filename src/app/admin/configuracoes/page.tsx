import { requireSalaoUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ConfiguracoesClient } from './ConfiguracoesClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Configurações · Matrus' }

export default async function ConfiguracoesPage() {
  const profile = await requireSalaoUser(['admin'])
  const supabase = createClient()

  const { data: settingsRows } = await supabase.from('salao_settings').select('key, value')
  const settings: Record<string, unknown> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value

  let unitId = profile.unit_id
  if (!unitId) {
    const { data: firstUnit } = await supabase.from('salao_units').select('id').eq('active', true).limit(1).single()
    unitId = firstUnit?.id ?? null
  }

  const { data: tables } = await supabase
    .from('salao_tables')
    .select('*, qr_codes:salao_qr_codes(id, token, active)')
    .eq('unit_id', unitId ?? '')
    .order('number')

  return <ConfiguracoesClient initialSettings={settings} unitId={unitId} initialTables={tables ?? []} />
}
