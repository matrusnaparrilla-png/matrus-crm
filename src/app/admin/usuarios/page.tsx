import { requireSalaoUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { UsuariosClient } from './UsuariosClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Usuários · Matrus' }

export default async function UsuariosPage() {
  const profile = await requireSalaoUser(['admin'])
  const supabase = createClient()

  let unitId = profile.unit_id
  if (!unitId) {
    const { data: firstUnit } = await supabase.from('salao_units').select('id').eq('active', true).limit(1).single()
    unitId = firstUnit?.id ?? null
  }

  const { data: users } = await supabase.from('salao_users').select('*').order('created_at', { ascending: false })
  const { data: waiters } = await supabase.from('salao_waiters').select('id, name').eq('unit_id', unitId ?? '').order('name')

  return <UsuariosClient initialUsers={users ?? []} waiters={waiters ?? []} unitId={unitId} />
}
