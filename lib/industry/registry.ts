import {
  INDUSTRY_PRESETS,
  OPERATIONAL_MODEL_LABELS,
  getIndustryPreset,
} from '@/lib/industry/config'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Runtime industry registry.
 *
 * Industries are loaded from the database (public.industry_types) so new
 * industries can be added from admin/configuration without code changes.
 * The static presets in lib/industry/config.ts act only as a safe fallback
 * when the database is unavailable or a code is unknown.
 */

export type IndustryTerminology = {
  entity: string
  entities: string
  task: string
  tasks: string
  staff: string
  route: string
  resources: string
  schedule: string
}

export type OnboardingTemplateStep = {
  key: string
  title: string
  description?: string
  required: boolean
  href?: string
}

export type IndustryProfile = {
  code: string
  nameSv: string
  nameEn: string | null
  shortNameSv: string
  descriptionSv: string
  isActive: boolean
  sortOrder: number
  defaultOperationalModel: string
  allowedOperationalModels: string[]
  defaultLocale: string
  defaultTimezone: string
  defaultCurrency: string
  terminology: IndustryTerminology
  taskTypes: string[]
  resourceTypes: string[]
  statuses: string[]
  planningRules: string[]
  mobileActions: string[]
  onboardingTemplate: OnboardingTemplateStep[]
  featureDefaults: Record<string, unknown>
}

export type OperationalModelOption = {
  code: string
  label: string
  description: string | null
  sortOrder: number
}

export type CompanyRuntimeConfig = {
  companyId: string
  industryCode: string
  operationalModel: string
  terminology: Partial<IndustryTerminology>
  taskStatuses: string[]
  mobileActions: string[]
  planningRules: string[]
  settings: Record<string, unknown>
}

const DEFAULT_TERMINOLOGY: IndustryTerminology = {
  entity: 'Objekt',
  entities: 'Objekt',
  task: 'Uppdrag',
  tasks: 'Uppdrag',
  staff: 'Personal',
  route: 'Rutt',
  resources: 'Resurser',
  schedule: 'Schema',
}

const REGISTRY_CACHE_TTL_MS = 60_000
const RUNTIME_CONFIG_CACHE_TTL_MS = 30_000

let registryCache: { loadedAt: number; profiles: IndustryProfile[] } | null = null
const runtimeConfigCache = new Map<string, { loadedAt: number; config: CompanyRuntimeConfig | null }>()

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function asTerminology(value: unknown, fallback: IndustryTerminology): IndustryTerminology {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    entity: typeof raw.entity === 'string' ? raw.entity : fallback.entity,
    entities: typeof raw.entities === 'string' ? raw.entities : fallback.entities,
    task: typeof raw.task === 'string' ? raw.task : fallback.task,
    tasks: typeof raw.tasks === 'string' ? raw.tasks : fallback.tasks,
    staff: typeof raw.staff === 'string' ? raw.staff : fallback.staff,
    route: typeof raw.route === 'string' ? raw.route : fallback.route,
    resources: typeof raw.resources === 'string' ? raw.resources : fallback.resources,
    schedule: typeof raw.schedule === 'string' ? raw.schedule : fallback.schedule,
  }
}

function asOnboardingTemplate(value: unknown): OnboardingTemplateStep[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      key: typeof entry.key === 'string' ? entry.key : '',
      title: typeof entry.title === 'string' ? entry.title : '',
      description: typeof entry.description === 'string' ? entry.description : undefined,
      required: entry.required === true,
      href: typeof entry.href === 'string' ? entry.href : undefined,
    }))
    .filter((step) => step.key !== '' && step.title !== '')
}

/**
 * Fallback onboarding steps for industries without a stored template.
 */
export function buildFallbackOnboardingTemplate(terminology: IndustryTerminology): OnboardingTemplateStep[] {
  return [
    { key: 'company_information', title: 'Företagsuppgifter', description: 'Kontrollera namn, organisationsnummer, tidszon och språk.', required: true, href: '/settings' },
    { key: 'industry_model', title: 'Bransch och arbetssätt', description: 'Välj bransch och hur arbetet planeras i vardagen.', required: true, href: '/settings/industry' },
    { key: 'team_roles', title: 'Team och roller', description: 'Skapa team och bestäm vem som gör vad.', required: true, href: '/teams' },
    { key: 'staff', title: 'Personal och utförare', description: 'Lägg in personal som ska utföra arbetet.', required: true, href: '/staff' },
    { key: 'entities', title: terminology.entities, description: 'Registrera det arbetet utförs hos eller på.', required: true, href: '/entities' },
    { key: 'task_types', title: `${terminology.tasks} och typer`, description: 'Kontrollera vilka typer av arbete som finns.', required: true, href: '/settings/industry' },
    { key: 'resources', title: 'Resurser', description: 'Fordon, nycklar, utrustning och annat med ansvar.', required: false, href: '/resources' },
    { key: 'planning_rules', title: 'Planeringsregler', description: 'Tidsfönster, kompetenser och regler för planeringen.', required: false, href: '/settings/industry' },
    { key: 'communication', title: 'Kommunikation', description: 'Notiser och kontaktvägar för teamet.', required: false, href: '/settings' },
    { key: 'finish', title: 'Slutför', description: 'Markera onboarding som klar och börja planera.', required: true, href: '/onboarding' },
  ]
}

function profileFromPreset(code: string): IndustryProfile {
  const preset = getIndustryPreset(code)
  const terminology = asTerminology(preset.terminology, DEFAULT_TERMINOLOGY)
  return {
    code: preset.code,
    nameSv: preset.label,
    nameEn: null,
    shortNameSv: preset.shortLabel,
    descriptionSv: preset.description,
    isActive: true,
    sortOrder: 100,
    defaultOperationalModel: preset.operationalModels[0] ?? 'route_based',
    allowedOperationalModels: [...preset.operationalModels],
    defaultLocale: 'sv',
    defaultTimezone: 'Europe/Stockholm',
    defaultCurrency: 'SEK',
    terminology,
    taskTypes: [...preset.taskTypes],
    resourceTypes: [...preset.resourceTypes],
    statuses: [...preset.statuses],
    planningRules: [...preset.planningRules],
    mobileActions: [...preset.mobileActions],
    onboardingTemplate: buildFallbackOnboardingTemplate(terminology),
    featureDefaults: { all_core_modules: true },
  }
}

function fallbackProfiles(): IndustryProfile[] {
  return Object.keys(INDUSTRY_PRESETS).map((code) => profileFromPreset(code))
}

type IndustryTypeRow = {
  code: string
  name: string | null
  name_sv: string | null
  name_en: string | null
  short_name_sv: string | null
  short_name_en: string | null
  description: string | null
  description_sv: string | null
  is_active: boolean | null
  archived_at: string | null
  sort_order: number | null
  default_operational_model: string | null
  allowed_operational_models: string[] | null
  default_locale: string | null
  default_timezone: string | null
  default_currency: string | null
  terminology: unknown
  task_types: unknown
  resource_types: unknown
  statuses: unknown
  planning_rules: unknown
  mobile_actions: unknown
  onboarding_template: unknown
  feature_defaults: unknown
}

function profileFromRow(row: IndustryTypeRow): IndustryProfile {
  const presetFallback = profileFromPreset(row.code)
  const terminology = asTerminology(row.terminology, presetFallback.terminology)
  const template = asOnboardingTemplate(row.onboarding_template)

  return {
    code: row.code,
    nameSv: row.name_sv ?? row.name ?? presetFallback.nameSv,
    nameEn: row.name_en ?? null,
    shortNameSv: row.short_name_sv ?? row.name_sv ?? row.name ?? presetFallback.shortNameSv,
    descriptionSv: row.description_sv ?? row.description ?? presetFallback.descriptionSv,
    isActive: Boolean(row.is_active) && !row.archived_at,
    sortOrder: row.sort_order ?? 100,
    defaultOperationalModel: row.default_operational_model ?? presetFallback.defaultOperationalModel,
    allowedOperationalModels: row.allowed_operational_models?.length
      ? row.allowed_operational_models
      : presetFallback.allowedOperationalModels,
    defaultLocale: row.default_locale ?? 'sv',
    defaultTimezone: row.default_timezone ?? 'Europe/Stockholm',
    defaultCurrency: row.default_currency ?? 'SEK',
    terminology,
    taskTypes: asStringArray(row.task_types).length ? asStringArray(row.task_types) : presetFallback.taskTypes,
    resourceTypes: asStringArray(row.resource_types).length ? asStringArray(row.resource_types) : presetFallback.resourceTypes,
    statuses: asStringArray(row.statuses).length ? asStringArray(row.statuses) : presetFallback.statuses,
    planningRules: asStringArray(row.planning_rules).length ? asStringArray(row.planning_rules) : presetFallback.planningRules,
    mobileActions: asStringArray(row.mobile_actions).length ? asStringArray(row.mobile_actions) : presetFallback.mobileActions,
    onboardingTemplate: template.length ? template : buildFallbackOnboardingTemplate(terminology),
    featureDefaults: (row.feature_defaults && typeof row.feature_defaults === 'object'
      ? (row.feature_defaults as Record<string, unknown>)
      : { all_core_modules: true }),
  }
}

const INDUSTRY_TYPE_COLUMNS =
  'code, name, name_sv, name_en, short_name_sv, short_name_en, description, description_sv, is_active, archived_at, sort_order, default_operational_model, allowed_operational_models, default_locale, default_timezone, default_currency, terminology, task_types, resource_types, statuses, planning_rules, mobile_actions, onboarding_template, feature_defaults'

/**
 * Loads the full industry registry (active and inactive) from the database,
 * falling back to the static presets if the database is unavailable.
 */
export async function getIndustryRegistry(): Promise<IndustryProfile[]> {
  const now = Date.now()
  if (registryCache && now - registryCache.loadedAt < REGISTRY_CACHE_TTL_MS) {
    return registryCache.profiles
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('industry_types')
      .select(INDUSTRY_TYPE_COLUMNS)
      .order('sort_order', { ascending: true })
      .order('code', { ascending: true })

    if (error || !data?.length) {
      return registryCache?.profiles ?? fallbackProfiles()
    }

    const profiles = (data as IndustryTypeRow[]).map(profileFromRow)
    registryCache = { loadedAt: now, profiles }
    return profiles
  } catch {
    return registryCache?.profiles ?? fallbackProfiles()
  }
}

/**
 * Active industries for pickers, public pages and onboarding.
 */
export async function getActiveIndustryProfiles(): Promise<IndustryProfile[]> {
  const registry = await getIndustryRegistry()
  const active = registry.filter((profile) => profile.isActive)
  return active.length ? active : fallbackProfiles()
}

/**
 * Resolves a single industry profile. Unknown codes fall back to 'other'
 * (never crashes on a new industry code that old code does not know about).
 */
export async function getIndustryProfile(code: string | null | undefined): Promise<IndustryProfile> {
  const registry = await getIndustryRegistry()
  const wanted = code ?? 'other'
  return (
    registry.find((profile) => profile.code === wanted) ??
    registry.find((profile) => profile.code === 'other') ??
    profileFromPreset(wanted)
  )
}

/**
 * Operational models from the database with a static fallback.
 */
export async function getOperationalModels(): Promise<OperationalModelOption[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('operational_models')
      .select('code, name, description, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error || !data?.length) throw error ?? new Error('empty')

    return data.map((row: { code: string; name: string | null; description: string | null; sort_order: number | null }) => ({
      code: row.code,
      label: row.name ?? OPERATIONAL_MODEL_LABELS[row.code] ?? row.code,
      description: row.description,
      sortOrder: row.sort_order ?? 100,
    }))
  } catch {
    return Object.entries(OPERATIONAL_MODEL_LABELS).map(([code, label], index) => ({
      code,
      label,
      description: null,
      sortOrder: (index + 1) * 10,
    }))
  }
}

/**
 * The company's runtime industry configuration, if any.
 * Cached briefly since it is read on nearly every page render.
 */
export async function getCompanyRuntimeConfig(companyId: string): Promise<CompanyRuntimeConfig | null> {
  const cached = runtimeConfigCache.get(companyId)
  if (cached && Date.now() - cached.loadedAt < RUNTIME_CONFIG_CACHE_TTL_MS) {
    return cached.config
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('industry_runtime_configs')
      .select('company_id, industry_code, operational_model, terminology, task_statuses, mobile_actions, planning_rules, settings')
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) return cached?.config ?? null
    if (!data) {
      runtimeConfigCache.set(companyId, { loadedAt: Date.now(), config: null })
      return null
    }

    const config: CompanyRuntimeConfig = {
      companyId: data.company_id,
      industryCode: data.industry_code ?? 'other',
      operationalModel: data.operational_model ?? 'route_based',
      terminology: (data.terminology && typeof data.terminology === 'object' ? data.terminology : {}) as Partial<IndustryTerminology>,
      taskStatuses: asStringArray(data.task_statuses),
      mobileActions: asStringArray(data.mobile_actions),
      planningRules: asStringArray(data.planning_rules),
      settings: (data.settings && typeof data.settings === 'object' ? data.settings : {}) as Record<string, unknown>,
    }

    runtimeConfigCache.set(companyId, { loadedAt: Date.now(), config })
    return config
  } catch {
    return cached?.config ?? null
  }
}

/**
 * Resolves customer-facing terminology for a company:
 * company runtime overrides > industry profile > neutral defaults.
 */
export async function resolveIndustryTerminology(
  companyId: string | null | undefined,
  fallbackIndustryCode?: string | null,
): Promise<IndustryTerminology> {
  const runtime = companyId ? await getCompanyRuntimeConfig(companyId) : null
  const industryCode = runtime?.industryCode ?? fallbackIndustryCode ?? 'other'
  const profile = await getIndustryProfile(industryCode)
  return asTerminology(runtime?.terminology ?? {}, profile.terminology)
}

/**
 * Alias kept for the API described in the go-live specification.
 */
export async function getIndustryTerminology(companyId: string): Promise<IndustryTerminology> {
  return resolveIndustryTerminology(companyId)
}

/**
 * Clears the in-memory registry cache (used after admin edits).
 */
export function invalidateIndustryRegistryCache() {
  registryCache = null
  runtimeConfigCache.clear()
}

/**
 * Clears the cached runtime config for one company (used after settings updates).
 */
export function invalidateCompanyRuntimeConfigCache(companyId: string) {
  runtimeConfigCache.delete(companyId)
}
