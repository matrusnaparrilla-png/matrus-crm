import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.enum(['admin', 'gerente', 'garcom']),
  unit_id: z.string().uuid(),
  waiter_id: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: requester } = await supabase.from('salao_users').select('role').eq('id', user.id).single()
  if (requester?.role !== 'admin') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const admin = createAdminClient()
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? 'Erro ao criar usuário' }, { status: 500 })
  }

  const { error: profileError } = await admin.from('salao_users').insert({
    id: created.user.id,
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    unit_id: parsed.data.unit_id,
    waiter_id: parsed.data.role === 'garcom' ? parsed.data.waiter_id ?? null : null,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: 'Erro ao criar perfil do usuário' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
