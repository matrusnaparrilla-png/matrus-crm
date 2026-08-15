'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QrCodeModal } from '@/components/salao/QrCodeModal'
import toast from 'react-hot-toast'
import { Loader2, Plus, QrCode as QrCodeIcon, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

interface TableRow {
  id: string
  number: number
  active: boolean
  qr_codes: { id: string; token: string; active: boolean }[]
}

export function ConfiguracoesClient({
  initialSettings, unitId, initialTables,
}: {
  initialSettings: Record<string, unknown>
  unitId: string | null
  initialTables: TableRow[]
}) {
  const supabase = createClient()
  const [companyName, setCompanyName] = useState((initialSettings.company_name as string) ?? 'Matrus')
  const [googleLink, setGoogleLink] = useState((initialSettings.google_review_link as string) ?? '')
  const [thankYou, setThankYou] = useState((initialSettings.thank_you_message as string) ?? '')
  const [alertThreshold, setAlertThreshold] = useState(Number(initialSettings.alert_score_threshold ?? 3))
  const [minEvals, setMinEvals] = useState(Number(initialSettings.min_evaluations_for_ranking ?? 5))
  const [saving, setSaving] = useState(false)

  const [tables, setTables] = useState(initialTables)
  const [newTableNumber, setNewTableNumber] = useState('')
  const [qrTarget, setQrTarget] = useState<{ label: string; token: string } | null>(null)

  async function saveSettings() {
    setSaving(true)
    const updates = [
      { key: 'company_name', value: companyName },
      { key: 'google_review_link', value: googleLink || null },
      { key: 'thank_you_message', value: thankYou },
      { key: 'alert_score_threshold', value: alertThreshold },
      { key: 'min_evaluations_for_ranking', value: minEvals },
    ]
    for (const u of updates) {
      const { error } = await supabase.from('salao_settings').upsert({ key: u.key, value: u.value }, { onConflict: 'key' })
      if (error) {
        toast.error(`Erro ao salvar "${u.key}"`)
        setSaving(false)
        return
      }
    }
    toast.success('Configurações salvas')
    setSaving(false)
  }

  async function addTable() {
    if (!unitId || !newTableNumber) return
    const { data: table, error } = await supabase
      .from('salao_tables')
      .insert({ unit_id: unitId, number: Number(newTableNumber) })
      .select('id, number, active')
      .single()
    if (error || !table) {
      toast.error('Erro ao cadastrar mesa (número já existe?)')
      return
    }
    const { error: qrError } = await supabase.from('salao_qr_codes').insert({ table_id: table.id })
    if (qrError) toast.error('Mesa criada, mas houve erro ao gerar o QR Code')
    setTables((prev) => [...prev, { ...table, qr_codes: [] }].sort((a, b) => a.number - b.number))
    setNewTableNumber('')
    reloadTables()
  }

  async function reloadTables() {
    if (!unitId) return
    const { data } = await supabase.from('salao_tables').select('*, qr_codes:salao_qr_codes(id, token, active)').eq('unit_id', unitId).order('number')
    setTables((data as TableRow[]) ?? [])
  }

  async function toggleTable(t: TableRow) {
    const { error } = await supabase.from('salao_tables').update({ active: !t.active }).eq('id', t.id)
    if (error) toast.error('Erro ao atualizar mesa')
    else reloadTables()
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-white">Configurações</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Identidade, link do Google e regras de alerta</p>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Identidade</h2>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Nome da empresa</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Mensagem de agradecimento</label>
          <textarea value={thankYou} onChange={(e) => setThankYou(e.target.value)} className="input min-h-20 resize-none" />
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Avaliação no Google</h2>
        <div className="flex items-start gap-2 bg-brand-500/5 border border-brand-500/20 rounded-lg p-3">
          <Info size={15} className="text-brand-400 shrink-0 mt-0.5" />
          <p className="text-xs text-neutral-400">
            Este link é exibido para <strong className="text-neutral-300">todos os clientes</strong> ao final da avaliação,
            independentemente da nota dada. Nunca é ocultado de clientes insatisfeitos.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 mb-1.5">Link de avaliação do Google Business Profile</label>
          <input value={googleLink} onChange={(e) => setGoogleLink(e.target.value)} className="input" placeholder="https://g.page/r/..." />
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Regras de alerta e ranking</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Nota limite para alerta (≤)</label>
            <input type="number" min={1} max={5} value={alertThreshold} onChange={(e) => setAlertThreshold(Number(e.target.value))} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Mín. avaliações p/ ranking</label>
            <input type="number" min={1} value={minEvals} onChange={(e) => setMinEvals(Number(e.target.value))} className="input" />
          </div>
        </div>
      </div>

      <button onClick={saveSettings} disabled={saving} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
        {saving && <Loader2 size={15} className="animate-spin" />} Salvar configurações
      </button>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Mesas (QR Code por mesa — opcional)</h2>
        <div className="flex gap-2">
          <input value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} placeholder="Número da mesa" className="input" type="number" />
          <button onClick={addTable} className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 shrink-0">
            <Plus size={15} /> Adicionar
          </button>
        </div>
        <div className="divide-y divide-surface-border">
          {tables.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2.5">
              <span className={cn('text-sm flex-1', t.active ? 'text-white' : 'text-neutral-600 line-through')}>Mesa {t.number}</span>
              <button onClick={() => toggleTable(t)} className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', t.active ? 'text-green-400 border-green-400/30' : 'text-neutral-500 border-surface-border')}>
                {t.active ? 'Ativa' : 'Inativa'}
              </button>
              {t.qr_codes?.[0] && (
                <button onClick={() => setQrTarget({ label: `Mesa ${t.number}`, token: t.qr_codes[0].token })} className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5">
                  <QrCodeIcon size={13} /> QR Code
                </button>
              )}
            </div>
          ))}
          {tables.length === 0 && <p className="text-sm text-neutral-500 py-4 text-center">Nenhuma mesa cadastrada</p>}
        </div>
      </div>

      {qrTarget && (
        <QrCodeModal url={`${APP_URL}/avaliar/${qrTarget.token}`} waiterName={qrTarget.label} companyName={companyName} onClose={() => setQrTarget(null)} />
      )}
    </div>
  )
}
