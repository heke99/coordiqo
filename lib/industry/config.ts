export type IndustryCode =
  | 'home_care'
  | 'healthcare'
  | 'cleaning'
  | 'property'
  | 'construction'
  | 'parking'
  | 'staffing'
  | 'field_service'
  | 'security'
  | 'other'

export type OperationalModelCode =
  | 'route_based'
  | 'area_based'
  | 'object_based'
  | 'case_based'
  | 'calendar_based'
  | 'patrol_based'
  | 'team_based'
  | 'project_based'
  | 'on_call'

export const INDUSTRY_LABELS: Record<string, string> = {
  home_care: 'Hemtjänst',
  healthcare: 'Vård och hemsjukvård',
  cleaning: 'Städ',
  property: 'Fastighet och hyresvärd',
  construction: 'Bygg',
  parking: 'Parkeringsövervakning',
  staffing: 'Bemanning',
  field_service: 'Tekniker och service',
  security: 'Bevakning',
  other: 'Annan verksamhet',
}

export const OPERATIONAL_MODEL_LABELS: Record<string, string> = {
  route_based: 'Ruttbaserad',
  area_based: 'Områdesbaserad',
  object_based: 'Objektbaserad',
  case_based: 'Ärendebaserad',
  calendar_based: 'Kalenderbaserad',
  patrol_based: 'Patrullbaserad',
  team_based: 'Teambaserad',
  project_based: 'Projektbaserad',
  on_call: 'Jourbaserad',
}

export const CORE_MODULES = [
  { code: 'foundation', label: 'Plattformsgrund', description: 'Auth, företag, roller, team och tenant-isolering.' },
  { code: 'industry_engine', label: 'Branschmotor', description: 'Styr språk, navigation, moduler och objektpresets per företag.' },
  { code: 'resources', label: 'Personal och resurser', description: 'Personalprofiler, fordon, utrustning och organisation.' },
  { code: 'entities', label: 'Objektregister', description: 'Flexibel modell för kunder, platser, fastigheter, patienter och andra objekt.' },
  { code: 'tasks', label: 'Uppdrag och arbetsorder', description: 'Ärenden, besök, arbetsorder och statusflöden.' },
  { code: 'planning', label: 'Planering', description: 'Tilldelning, dagplan och senare optimering.' },
  { code: 'mobile_staff', label: 'Mobil personalvy', description: 'Dagens rutt, check-in/out och utförande i fält.' },
]

export function getIndustryLabel(code: string | null | undefined) {
  if (!code) return 'Bransch ej vald'
  return INDUSTRY_LABELS[code] ?? code
}

export function getOperationalModelLabel(code: string | null | undefined) {
  if (!code) return 'Operativ modell ej vald'
  return OPERATIONAL_MODEL_LABELS[code] ?? code
}
