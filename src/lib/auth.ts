import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { SalaoUser } from '@/types/salao'

export async function getSalaoUser(): Promise<SalaoUser | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('salao_users').select('*').eq('id', user.id).single()
  return (data as SalaoUser) ?? null
}

export async function requireSalaoUser(allowedRoles?: SalaoUser['role'][]): Promise<SalaoUser> {
  const profile = await getSalaoUser()
  if (!profile || !profile.active) redirect('/login')
  if (allowedRoles && !allowedRoles.includes(profile.role)) redirect('/admin')
  return profile
}
