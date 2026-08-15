import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AvaliacaoWizard } from './AvaliacaoWizard'
import { Frown } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Avalie sua experiência · Matrus' }
export const dynamic = 'force-dynamic'

interface QrContext {
  qr_code_id: string
  unit: { id: string; name: string }
  waiter: { id: string; name: string; photo_url: string | null } | null
  table: { id: string; number: number } | null
}

export default async function AvaliarPage({ params }: { params: { token: string } }) {
  const supabase = createClient()
  const { data } = await supabase.rpc('get_salao_qr_context', { p_token: params.token })
  const context = data as QrContext | null

  if (!context?.unit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="text-center">
          <Frown size={40} className="mx-auto text-neutral-700 mb-3" />
          <h1 className="text-lg font-semibold text-white mb-1">QR Code inválido</h1>
          <p className="text-sm text-neutral-500">Verifique o código ou chame um atendente.</p>
        </div>
      </div>
    )
  }

  const admin = createAdminClient()
  const { data: session } = await admin
    .from('salao_sessions')
    .insert({
      unit_id: context.unit.id,
      waiter_id: context.waiter?.id ?? null,
      table_id: context.table?.id ?? null,
      qr_code_id: context.qr_code_id,
    })
    .select('id')
    .single()

  const { data: settingsRaw } = await supabase.rpc('get_salao_public_settings')
  const settings = (settingsRaw ?? {}) as Record<string, unknown>

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="text-center">
          <Frown size={40} className="mx-auto text-neutral-700 mb-3" />
          <h1 className="text-lg font-semibold text-white mb-1">Não foi possível iniciar</h1>
          <p className="text-sm text-neutral-500">Tente novamente em instantes.</p>
        </div>
      </div>
    )
  }

  return (
    <AvaliacaoWizard
      sessionId={session.id}
      waiterName={context.waiter?.name ?? null}
      companyName={(settings.company_name as string) ?? 'Matrus'}
      googleReviewLink={(settings.google_review_link as string) ?? null}
      thankYouMessage={(settings.thank_you_message as string) ?? 'Obrigado pela sua avaliação!'}
      qrCodeId={context.qr_code_id}
    />
  )
}
