export type SalaoUserRole = 'admin' | 'gerente' | 'garcom'

export type ReturnIntent = 'certamente' | 'provavelmente' | 'talvez' | 'provavelmente_nao' | 'nao_voltaria'

export type CategoryGroup = 'atendimento' | 'comida' | 'ambiente' | 'operacao'

export type AlertType = 'negativo' | 'positivo'
export type AlertStatus = 'novo' | 'em_analise' | 'resolvido' | 'ignorado'

export interface SalaoUser {
  id: string
  unit_id: string | null
  waiter_id: string | null
  name: string
  email: string
  role: SalaoUserRole
  active: boolean
  created_at: string
}

export interface Waiter {
  id: string
  unit_id: string
  name: string
  photo_url: string | null
  phone: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface SalaoTable {
  id: string
  unit_id: string
  number: number
  active: boolean
  created_at: string
}

export interface QrCode {
  id: string
  waiter_id: string | null
  table_id: string | null
  token: string
  active: boolean
  created_at: string
  regenerated_at: string | null
}

export interface Evaluation {
  id: string
  session_id: string
  unit_id: string
  waiter_id: string | null
  table_id: string | null
  overall_score: number
  nps_score: number
  return_intent: ReturnIntent
  best_aspects: string[]
  improvement_comment: string | null
  comment: string | null
  client_name: string | null
  client_phone: string | null
  client_birthdate: string | null
  created_at: string
}

export interface EvaluationCategory {
  id: string
  evaluation_id: string
  category_group: CategoryGroup
  category: string
  score: number
  comment: string | null
}

export interface SalaoAlert {
  id: string
  evaluation_id: string
  type: AlertType
  status: AlertStatus
  reason: string
  internal_note: string | null
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

export interface WaiterRanking {
  waiter_id: string
  unit_id: string
  name: string
  photo_url: string | null
  active: boolean
  total_evaluations: number
  avg_overall: number | null
  avg_nps_score: number | null
  promoters: number
  detractors: number
  nps: number | null
  five_star_count: number
  five_star_pct: number | null
  complaint_count: number
}

export const RETURN_INTENT_LABELS: Record<ReturnIntent, string> = {
  certamente: 'Com certeza',
  provavelmente: 'Provavelmente',
  talvez: 'Talvez',
  provavelmente_nao: 'Provavelmente não',
  nao_voltaria: 'Não voltaria',
}

export const BEST_ASPECT_OPTIONS = [
  { value: 'atendimento', label: 'Atendimento' },
  { value: 'comida', label: 'Comida' },
  { value: 'ambiente', label: 'Ambiente' },
  { value: 'agilidade', label: 'Agilidade' },
  { value: 'bebidas', label: 'Chopp/bebidas' },
  { value: 'custo_beneficio', label: 'Preço/custo-benefício' },
  { value: 'outro', label: 'Outro' },
] as const

export interface CategoryDef {
  key: string
  label: string
}

export const CATEGORY_CATALOG: Record<CategoryGroup, CategoryDef[]> = {
  atendimento: [
    { key: 'cordialidade', label: 'Cordialidade' },
    { key: 'agilidade', label: 'Agilidade' },
    { key: 'atencao', label: 'Atenção às necessidades' },
    { key: 'conhecimento_cardapio', label: 'Conhecimento do cardápio' },
    { key: 'simpatia', label: 'Simpatia' },
  ],
  comida: [
    { key: 'sabor', label: 'Sabor' },
    { key: 'apresentacao', label: 'Apresentação dos pratos' },
    { key: 'temperatura', label: 'Temperatura' },
    { key: 'qualidade_percebida', label: 'Qualidade percebida' },
  ],
  ambiente: [
    { key: 'limpeza', label: 'Limpeza' },
    { key: 'organizacao', label: 'Organização' },
    { key: 'conforto', label: 'Conforto' },
    { key: 'musica', label: 'Música' },
    { key: 'ambiente_geral', label: 'Ambiente geral' },
  ],
  operacao: [
    { key: 'tempo_pedido', label: 'Tempo para receber o pedido' },
    { key: 'tempo_pratos', label: 'Tempo para receber os pratos' },
    { key: 'organizacao_salao', label: 'Organização do salão' },
  ],
}

export const CATEGORY_GROUP_LABELS: Record<CategoryGroup, string> = {
  atendimento: 'Atendimento',
  comida: 'Comida',
  ambiente: 'Ambiente',
  operacao: 'Operação',
}
