'use client'

import { useMemo, useState } from 'react'
import { PartyPopper, Loader2, ExternalLink, Star } from 'lucide-react'
import { StarRating } from '@/components/salao/StarRating'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

function getFingerprint() {
  if (typeof window === 'undefined') return ''
  const KEY = 'salao_fp'
  let fp = localStorage.getItem(KEY)
  if (!fp) {
    fp = crypto.randomUUID()
    localStorage.setItem(KEY, fp)
  }
  return fp
}

const HOW_HEARD_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'google', label: 'Google' },
  { value: 'indicacao', label: 'Indicação de amigo/família' },
  { value: 'passando', label: 'Passando em frente' },
  { value: 'ja_conhecia', label: 'Já conhecia' },
  { value: 'outro', label: 'Outro' },
] as const

export function AvaliacaoWizard({
  sessionId,
  qrCodeId,
  waiterName,
  companyName,
  googleReviewLink,
  thankYouMessage,
}: {
  sessionId: string
  qrCodeId: string
  waiterName: string | null
  companyName: string
  googleReviewLink: string | null
  thankYouMessage: string
}) {
  const steps = ['dados', 'avaliacao', 'fim']
  const [stepIndex, setStepIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [started, setStarted] = useState(false)

  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientBirthdate, setClientBirthdate] = useState('')

  const [howHeard, setHowHeard] = useState('')
  const [howHeardOther, setHowHeardOther] = useState('')
  const [recepcao, setRecepcao] = useState(0)
  const [lanche, setLanche] = useState(0)
  const [atendimento, setAtendimento] = useState(0)

  const current = steps[stepIndex]
  const progress = current === 'dados' ? 50 : 100

  const isBirthdateValid = useMemo(() => {
    if (!clientBirthdate) return false
    const d = new Date(clientBirthdate)
    if (Number.isNaN(d.getTime())) return false
    return d <= new Date()
  }, [clientBirthdate])

  const canAdvanceDados = clientName.trim().length >= 2 && clientPhone.trim().length >= 8 && isBirthdateValid

  const canSubmit = useMemo(() => {
    const howHeardOk = howHeard !== '' && (howHeard !== 'outro' || howHeardOther.trim().length > 0)
    return howHeardOk && recepcao > 0 && lanche > 0 && atendimento > 0
  }, [howHeard, howHeardOther, recepcao, lanche, atendimento])

  function goToAvaliacao() {
    if (!canAdvanceDados) return
    setStepIndex(1)
  }

  function back() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1)
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)

    const avg = (recepcao + lanche + atendimento) / 3
    const overallScore = Math.round(avg)
    const npsScore = Math.max(0, Math.min(10, Math.round(avg * 2)))
    const returnIntent =
      avg >= 4.5 ? 'certamente' : avg >= 3.5 ? 'provavelmente' : avg >= 2.5 ? 'talvez' : avg >= 1.5 ? 'provavelmente_nao' : 'nao_voltaria'
    const howHeardLabel = HOW_HEARD_OPTIONS.find((o) => o.value === howHeard)?.label ?? howHeard
    const howHeardText = howHeard === 'outro' ? `Outro: ${howHeardOther.trim()}` : howHeardLabel

    const categories = [
      { group: 'atendimento' as const, category: 'recepcao', score: recepcao },
      { group: 'comida' as const, category: 'lanche', score: lanche },
      { group: 'atendimento' as const, category: 'atendimento_geral', score: atendimento },
    ]

    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          qr_code_id: qrCodeId,
          fingerprint: getFingerprint(),
          overall_score: overallScore,
          nps_score: npsScore,
          return_intent: returnIntent,
          best_aspects: [],
          comment: howHeardText,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim(),
          client_birthdate: clientBirthdate,
          categories,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Não foi possível enviar sua avaliação')
        setSubmitting(false)
        return
      }
      setStepIndex(2)
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!started) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-5">
          <Star size={28} className="text-brand-400 fill-brand-400" />
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">Como foi sua experiência na {companyName}?</h1>
        <p className="text-sm text-neutral-400 max-w-xs mb-8">
          Leva menos de 2 minutos e sua opinião ajuda a nossa equipe a melhorar todos os dias.
        </p>
        <button onClick={() => setStarted(true)} className="btn-primary w-full max-w-xs py-3.5 text-sm">
          AVALIAR MINHA EXPERIÊNCIA
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {current !== 'fim' && (
        <div className="h-1 bg-surface-border">
          <div className="h-1 bg-brand-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex-1 flex flex-col px-5 py-6 max-w-md w-full mx-auto animate-fade-in" key={current}>
        {current === 'dados' && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Seus dados</h2>
            <p className="text-sm text-neutral-500 mb-5">Preencha para começar sua avaliação</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Nome *</label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="input" placeholder="Seu nome" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Telefone *</label>
                <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="input" placeholder="(00) 00000-0000" inputMode="tel" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Data de nascimento *</label>
                <input
                  type="date"
                  value={clientBirthdate}
                  onChange={(e) => setClientBirthdate(e.target.value)}
                  className="input"
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>
          </div>
        )}

        {current === 'avaliacao' && (
          <div className="space-y-8">
            <div>
              <p className="text-sm font-medium text-neutral-300 mb-2.5">Como você conheceu a Matrus?</p>
              <div className="flex flex-wrap gap-2">
                {HOW_HEARD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setHowHeard(opt.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      howHeard === opt.value ? 'bg-brand-500/15 border-brand-500 text-brand-400' : 'border-surface-border text-neutral-400'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {howHeard === 'outro' && (
                <input
                  value={howHeardOther}
                  onChange={(e) => setHowHeardOther(e.target.value)}
                  className="input mt-3"
                  placeholder="Como você conheceu?"
                />
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-300 mb-2.5">Como foi a recepção?</p>
              <div className="flex justify-center py-2">
                <StarRating value={recepcao} onChange={setRecepcao} size={36} />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-300 mb-2.5">Como estava o lanche?</p>
              <div className="flex justify-center py-2">
                <StarRating value={lanche} onChange={setLanche} size={36} />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-300 mb-2.5">Como foi o atendimento?</p>
              <div className="flex justify-center py-2">
                <StarRating value={atendimento} onChange={setAtendimento} size={36} />
              </div>
            </div>
          </div>
        )}

        {current === 'fim' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-5">
              <PartyPopper size={28} className="text-green-400" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Obrigado!</h1>
            <p className="text-sm text-neutral-400 max-w-xs mb-8">{thankYouMessage}</p>
            {googleReviewLink && (
              <a
                href={googleReviewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full max-w-xs py-3.5 text-sm flex items-center justify-center gap-2"
              >
                AVALIAR A {companyName.toUpperCase()} NO GOOGLE
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        )}

        {current !== 'fim' && (
          <div className="mt-auto pt-6 flex items-center gap-3 sticky bottom-0 bg-surface pb-2">
            {stepIndex > 0 && (
              <button onClick={back} className="btn-secondary px-4 py-3 text-sm">
                Voltar
              </button>
            )}
            {current === 'dados' ? (
              <button onClick={goToAvaliacao} disabled={!canAdvanceDados} className="btn-primary flex-1 py-3 text-sm">
                Continuar
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={!canSubmit || submitting} className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2">
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Enviar avaliação
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
