'use client'

import { useMemo, useState } from 'react'
import { PartyPopper, Loader2, ExternalLink, Star } from 'lucide-react'
import { StarRating, CategoryRow } from '@/components/salao/StarRating'
import { CATEGORY_CATALOG, BEST_ASPECT_OPTIONS, RETURN_INTENT_LABELS, type ReturnIntent } from '@/types/salao'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type CategoryScores = Record<string, number>

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
  const hasWaiterStep = !!waiterName
  const steps = ['dados', 'avaliacao', 'fim']
  const [stepIndex, setStepIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [started, setStarted] = useState(false)

  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientBirthdate, setClientBirthdate] = useState('')
  const [overall, setOverall] = useState(0)

  const [waiterCats, setWaiterCats] = useState<CategoryScores>({})
  const [waiterComment, setWaiterComment] = useState('')
  const [foodCats, setFoodCats] = useState<CategoryScores>({})
  const [foodComment, setFoodComment] = useState('')
  const [ambienceCats, setAmbienceCats] = useState<CategoryScores>({})
  const [ambienceComment, setAmbienceComment] = useState('')
  const [bestAspects, setBestAspects] = useState<string[]>([])
  const [improvementComment, setImprovementComment] = useState('')
  const [returnIntent, setReturnIntent] = useState<ReturnIntent | ''>('')
  const [nps, setNps] = useState<number | null>(null)

  const current = steps[stepIndex]
  const progress = current === 'dados' ? 50 : current === 'avaliacao' ? 100 : 100

  const isBirthdateValid = useMemo(() => {
    if (!clientBirthdate) return false
    const d = new Date(clientBirthdate)
    if (Number.isNaN(d.getTime())) return false
    return d <= new Date()
  }, [clientBirthdate])

  const canAdvanceDados = clientName.trim().length >= 2 && clientPhone.trim().length >= 8 && isBirthdateValid && overall > 0

  const canSubmit = useMemo(() => {
    const waiterOk = !hasWaiterStep || CATEGORY_CATALOG.atendimento.every((c) => (waiterCats[c.key] ?? 0) > 0)
    const foodOk = CATEGORY_CATALOG.comida.every((c) => (foodCats[c.key] ?? 0) > 0)
    const ambienceOk = [...CATEGORY_CATALOG.ambiente, ...CATEGORY_CATALOG.operacao].every((c) => (ambienceCats[c.key] ?? 0) > 0)
    return waiterOk && foodOk && ambienceOk && returnIntent !== '' && nps !== null
  }, [hasWaiterStep, waiterCats, foodCats, ambienceCats, returnIntent, nps])

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
    const categories = [
      ...(hasWaiterStep
        ? CATEGORY_CATALOG.atendimento.map((c) => ({ group: 'atendimento' as const, category: c.key, score: waiterCats[c.key] }))
        : []),
      ...CATEGORY_CATALOG.comida.map((c) => ({ group: 'comida' as const, category: c.key, score: foodCats[c.key] })),
      ...CATEGORY_CATALOG.ambiente.map((c) => ({ group: 'ambiente' as const, category: c.key, score: ambienceCats[c.key] })),
      ...CATEGORY_CATALOG.operacao.map((c) => ({ group: 'operacao' as const, category: c.key, score: ambienceCats[c.key] })),
    ]

    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          qr_code_id: qrCodeId,
          fingerprint: getFingerprint(),
          overall_score: overall,
          nps_score: nps,
          return_intent: returnIntent,
          best_aspects: bestAspects,
          improvement_comment: improvementComment,
          comment: waiterComment,
          food_comment: foodComment,
          ambience_comment: ambienceComment,
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

            <div className="space-y-3 mb-6">
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

            <p className="text-sm text-neutral-300 mb-2.5">De 1 a 5, como você avalia sua experiência na {companyName}?</p>
            <div className="flex justify-center py-4">
              <StarRating value={overall} onChange={setOverall} size={40} />
            </div>
          </div>
        )}

        {current === 'avaliacao' && (
          <div className="space-y-7">
            {hasWaiterStep && (
              <div>
                <h2 className="text-base font-semibold text-white mb-1">Seu atendente</h2>
                <p className="text-sm text-neutral-500 mb-2">Como você avalia o atendimento de {waiterName}?</p>
                <div className="divide-y divide-surface-border">
                  {CATEGORY_CATALOG.atendimento.map((c) => (
                    <CategoryRow key={c.key} label={c.label} value={waiterCats[c.key] ?? 0} onChange={(v) => setWaiterCats((s) => ({ ...s, [c.key]: v }))} />
                  ))}
                </div>
                <textarea
                  value={waiterComment}
                  onChange={(e) => setWaiterComment(e.target.value)}
                  placeholder="Comentário sobre o atendimento (opcional)"
                  className="input mt-3 min-h-16 resize-none"
                />
              </div>
            )}

            <div>
              <h2 className="text-base font-semibold text-white mb-1">A comida</h2>
              <p className="text-sm text-neutral-500 mb-2">Como você avalia os pratos que experimentou?</p>
              <div className="divide-y divide-surface-border">
                {CATEGORY_CATALOG.comida.map((c) => (
                  <CategoryRow key={c.key} label={c.label} value={foodCats[c.key] ?? 0} onChange={(v) => setFoodCats((s) => ({ ...s, [c.key]: v }))} />
                ))}
              </div>
              <textarea
                value={foodComment}
                onChange={(e) => setFoodComment(e.target.value)}
                placeholder="Comentário sobre a comida (opcional)"
                className="input mt-3 min-h-16 resize-none"
              />
            </div>

            <div>
              <h2 className="text-base font-semibold text-white mb-1">Ambiente e agilidade</h2>
              <p className="text-sm text-neutral-500 mb-2">Como foi o ambiente e o tempo de espera?</p>
              <div className="divide-y divide-surface-border">
                {[...CATEGORY_CATALOG.ambiente, ...CATEGORY_CATALOG.operacao].map((c) => (
                  <CategoryRow key={c.key} label={c.label} value={ambienceCats[c.key] ?? 0} onChange={(v) => setAmbienceCats((s) => ({ ...s, [c.key]: v }))} />
                ))}
              </div>
              <textarea
                value={ambienceComment}
                onChange={(e) => setAmbienceComment(e.target.value)}
                placeholder="Comentário sobre o ambiente (opcional)"
                className="input mt-3 min-h-16 resize-none"
              />
            </div>

            <div>
              <p className="text-sm text-neutral-300 mb-2.5">Qual foi a melhor parte da sua experiência?</p>
              <div className="flex flex-wrap gap-2">
                {BEST_ASPECT_OPTIONS.map((opt) => {
                  const selected = bestAspects.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBestAspects((s) => (selected ? s.filter((v) => v !== opt.value) : [...s, opt.value]))}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        selected ? 'bg-brand-500/15 border-brand-500 text-brand-400' : 'border-surface-border text-neutral-400'
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-sm text-neutral-300 mb-2">O que podemos melhorar?</p>
              <textarea
                value={improvementComment}
                onChange={(e) => setImprovementComment(e.target.value)}
                placeholder="Opcional"
                className="input min-h-16 resize-none"
              />
            </div>

            <div>
              <p className="text-sm text-neutral-300 mb-2.5">Você voltaria à {companyName}?</p>
              <div className="grid grid-cols-1 gap-2">
                {(Object.entries(RETURN_INTENT_LABELS) as [ReturnIntent, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReturnIntent(value)}
                    className={cn(
                      'text-left px-3.5 py-2.5 rounded-lg text-sm font-medium border transition-colors',
                      returnIntent === value ? 'bg-brand-500/15 border-brand-500 text-brand-400' : 'border-surface-border text-neutral-300'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-neutral-300 mb-2.5">Você recomendaria a {companyName} para um amigo?</p>
              <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
                {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNps(n)}
                    className={cn(
                      'aspect-square rounded-lg text-xs font-semibold border transition-colors',
                      nps === n ? 'bg-brand-500 border-brand-500 text-white' : 'border-surface-border text-neutral-400'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                <span>Nada provável</span>
                <span>Muito provável</span>
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
