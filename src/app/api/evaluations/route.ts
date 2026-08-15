import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const categorySchema = z.object({
  group: z.enum(['atendimento', 'comida', 'ambiente', 'operacao']),
  category: z.string().min(1).max(60),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

const payloadSchema = z.object({
  session_id: z.string().uuid(),
  qr_code_id: z.string().uuid(),
  fingerprint: z.string().min(8).max(80),
  overall_score: z.number().int().min(1).max(5),
  nps_score: z.number().int().min(0).max(10),
  return_intent: z.enum(['certamente', 'provavelmente', 'talvez', 'provavelmente_nao', 'nao_voltaria']),
  best_aspects: z.array(z.string()).max(10),
  improvement_comment: z.string().max(2000).optional(),
  comment: z.string().max(2000).optional(),
  client_name: z.string().max(120).optional(),
  client_phone: z.string().max(20).optional(),
  categories: z.array(categorySchema).min(1).max(30),
})

const RATE_LIMIT_WINDOW_MINUTES = 15

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { qr_code_id, fingerprint, ...payload } = parsed.data
  const admin = createAdminClient()

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString()
  const { data: recent } = await admin
    .from('salao_rate_limits')
    .select('id')
    .eq('qr_code_id', qr_code_id)
    .eq('fingerprint', fingerprint)
    .gte('created_at', since)
    .limit(1)

  if (recent && recent.length > 0) {
    return NextResponse.json(
      { error: 'Você já avaliou recentemente. Obrigado pelo carinho!' },
      { status: 429 }
    )
  }

  const { data: evaluationId, error } = await admin.rpc('submit_salao_evaluation', {
    payload: {
      session_id: parsed.data.session_id,
      overall_score: payload.overall_score,
      nps_score: payload.nps_score,
      return_intent: payload.return_intent,
      best_aspects: payload.best_aspects,
      improvement_comment: payload.improvement_comment ?? '',
      comment: payload.comment ?? '',
      client_name: payload.client_name ?? '',
      client_phone: payload.client_phone ?? '',
      categories: payload.categories,
    },
  })

  if (error) {
    return NextResponse.json({ error: 'Erro ao salvar avaliação' }, { status: 500 })
  }

  await admin.from('salao_rate_limits').insert({ qr_code_id, fingerprint })

  return NextResponse.json({ success: true, id: evaluationId })
}
