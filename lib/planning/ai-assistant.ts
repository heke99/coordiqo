import type { CreatePlanningRunInput } from '@/lib/planning/planning-engine'

export type AiPlanningIntent = {
  goal: 'create_draft' | 'replan' | 'what_if'
  confidence: number
  dateFrom: string | null
  dateTo: string | null
  teamId: string | null
  staffProfileId: string | null
  taskTypeId: string | null
  projectId: string | null
  areaLabel: string | null
  unscheduledOnly: boolean
  includeLockedAssignments: boolean
  priorities: string[]
  constraints: string[]
  explanation: string
}

function normalizePrompt(prompt: string) {
  return prompt.trim().toLowerCase()
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIsoDate(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

function mondayForCurrentWeek() {
  const today = new Date(`${todayIsoDate()}T00:00:00Z`)
  const day = today.getUTCDay() || 7
  today.setUTCDate(today.getUTCDate() - day + 1)
  return today.toISOString().slice(0, 10)
}

function resolveDateRange(prompt: string, explicitFrom: string | null, explicitTo: string | null) {
  if (explicitFrom) return { dateFrom: explicitFrom, dateTo: explicitTo ?? explicitFrom }

  const today = todayIsoDate()
  if (prompt.includes('imorgon')) return { dateFrom: addDaysIsoDate(today, 1), dateTo: addDaysIsoDate(today, 1) }
  if (prompt.includes('idag')) return { dateFrom: today, dateTo: today }
  if (prompt.includes('nästa vecka')) {
    const monday = addDaysIsoDate(mondayForCurrentWeek(), 7)
    return { dateFrom: monday, dateTo: addDaysIsoDate(monday, 6) }
  }
  if (prompt.includes('denna vecka') || prompt.includes('veckan')) {
    const monday = mondayForCurrentWeek()
    return { dateFrom: monday, dateTo: addDaysIsoDate(monday, 6) }
  }
  if (prompt.includes('helg')) {
    const monday = mondayForCurrentWeek()
    return { dateFrom: addDaysIsoDate(monday, 5), dateTo: addDaysIsoDate(monday, 6) }
  }

  return { dateFrom: today, dateTo: explicitTo ?? today }
}

function inferPriorities(prompt: string) {
  const priorities: string[] = []
  if (prompt.includes('restid') || prompt.includes('rutt') || prompt.includes('kör')) priorities.push('minimize_travel')
  if (prompt.includes('kontinuitet') || prompt.includes('samma personal')) priorities.push('continuity')
  if (prompt.includes('kompetens') || prompt.includes('certifikat') || prompt.includes('behörig')) priorities.push('skills_first')
  if (prompt.includes('akut') || prompt.includes('prio') || prompt.includes('viktig')) priorities.push('priority_first')
  if (prompt.includes('övertid') || prompt.includes('kapacitet')) priorities.push('avoid_overtime')
  return priorities.length ? priorities : ['balanced']
}

function inferConstraints(prompt: string) {
  const constraints: string[] = []
  if (prompt.includes('låst') || prompt.includes('ändra inte')) constraints.push('respect_locked_assignments')
  if (prompt.includes('bara oschemalagda') || prompt.includes('oschemalagda')) constraints.push('unscheduled_only')
  if (prompt.includes('alla uppdrag') || prompt.includes('även schemalagda')) constraints.push('include_scheduled_tasks')
  if (prompt.includes('projekt')) constraints.push('project_context')
  if (prompt.includes('team')) constraints.push('team_context')
  return constraints
}

function inferGoal(prompt: string) {
  if (prompt.includes('planera om') || prompt.includes('replan') || prompt.includes('sjuk') || prompt.includes('frånvaro')) return 'replan' as const
  if (prompt.includes('testa') || prompt.includes('simulera') || prompt.includes('what if')) return 'what_if' as const
  return 'create_draft' as const
}

export function interpretAiPlanningPrompt(params: {
  prompt: string
  explicitDateFrom?: string | null
  explicitDateTo?: string | null
  teamId?: string | null
  staffProfileId?: string | null
  taskTypeId?: string | null
  projectId?: string | null
  areaLabel?: string | null
  unscheduledOnly?: boolean | null
  includeLockedAssignments?: boolean | null
}): AiPlanningIntent {
  const normalized = normalizePrompt(params.prompt)
  const range = resolveDateRange(normalized, params.explicitDateFrom ?? null, params.explicitDateTo ?? null)
  const priorities = inferPriorities(normalized)
  const constraints = inferConstraints(normalized)
  const unscheduledOnly = params.unscheduledOnly ?? !constraints.includes('include_scheduled_tasks')
  const includeLockedAssignments = params.includeLockedAssignments ?? true
  const goal = inferGoal(normalized)
  const confidence = params.prompt.trim().length > 20 ? 0.78 : 0.55

  const explanationParts = [
    goal === 'replan' ? 'Assistenten tolkar detta som omplanering.' : goal === 'what_if' ? 'Assistenten tolkar detta som en simulering.' : 'Assistenten tolkar detta som en ny planeringskörning.',
    `Datum: ${range.dateFrom} – ${range.dateTo}.`,
    unscheduledOnly ? 'Endast oschemalagda uppdrag tas med.' : 'Även redan schemalagda uppdrag får tas med.',
    includeLockedAssignments ? 'Låsta tilldelningar respekteras i konfliktkontrollen.' : 'Låsta tilldelningar ignoreras i urvalet.',
  ]

  return {
    goal,
    confidence,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    teamId: params.teamId ?? null,
    staffProfileId: params.staffProfileId ?? null,
    taskTypeId: params.taskTypeId ?? null,
    projectId: params.projectId ?? null,
    areaLabel: params.areaLabel ?? null,
    unscheduledOnly,
    includeLockedAssignments,
    priorities,
    constraints,
    explanation: explanationParts.join(' '),
  }
}

export function planningInputFromIntent(params: {
  companyId: string
  actorUserId: string
  prompt: string
  intent: AiPlanningIntent
  name?: string | null
  industryType?: string | null
}): CreatePlanningRunInput {
  return {
    companyId: params.companyId,
    actorUserId: params.actorUserId,
    name: params.name?.trim() || `AI-planering · ${params.intent.dateFrom}`,
    dateFrom: params.intent.dateFrom ?? todayIsoDate(),
    dateTo: params.intent.dateTo ?? params.intent.dateFrom ?? todayIsoDate(),
    teamId: params.intent.teamId,
    staffProfileId: params.intent.staffProfileId,
    taskTypeId: params.intent.taskTypeId,
    industryType: params.industryType ?? null,
    areaLabel: params.intent.areaLabel,
    unscheduledOnly: params.intent.unscheduledOnly,
    includeLockedAssignments: params.intent.includeLockedAssignments,
    sourceType: params.intent.goal === 'what_if' ? 'what_if' : params.intent.goal === 'replan' ? 'replan' : 'ai_suggestion',
    sourceId: null,
    projectId: params.intent.projectId,
  }
}
