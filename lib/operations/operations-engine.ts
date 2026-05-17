export type DailyTaskRow = {
  id: string
  title: string
  status: string | null
  priority: string | null
  scheduled_start?: string | null
  scheduled_end?: string | null
  time_window_start?: string | null
  time_window_end?: string | null
  estimated_duration_minutes?: number | null
  custom_fields?: Record<string, unknown> | null
  entities?: { name?: string | null } | null
  task_types?: { name?: string | null } | null
}

export type DailyAssignmentRow = {
  id: string
  task_id: string
  staff_profile_id?: string | null
  team_id?: string | null
  planned_start_at: string
  planned_end_at: string
  status?: string | null
  staff_profiles?: { full_name?: string | null; transport_mode?: string | null } | null
  teams?: { name?: string | null } | null
  tasks?: DailyTaskRow | null
}

export type DailyResourceAssignmentRow = {
  id: string
  task_id?: string | null
  planned_staff_profile_id?: string | null
  planned_team_id?: string | null
  planned_start_at: string
  planned_end_at: string
  status?: string | null
  resource_assets?: { name?: string | null; resource_types?: { name?: string | null } | null } | null
  actual_resource_assets?: { name?: string | null } | null
  staff_profiles?: { full_name?: string | null } | null
  teams?: { name?: string | null } | null
  tasks?: { title?: string | null } | null
}

export type DailyDeviationRow = {
  id: string
  reason_code?: string | null
  comment?: string | null
  created_at: string
  staff_profiles?: { full_name?: string | null } | null
  resource_assets?: { name?: string | null } | null
}

export type DailyOperationsSummary = {
  totalAssignments: number
  totalTasks: number
  completedAssignments: number
  activeAssignments: number
  blockedAssignments: number
  unassignedTasks: number
  resourceIssues: number
  unconfirmedResources: number
  lateItems: number
}

function taskTime(task: DailyTaskRow | null | undefined) {
  return task?.scheduled_start ?? task?.time_window_start ?? null
}

export function getStopLabel(task: DailyTaskRow | null | undefined) {
  const fields = task?.custom_fields ?? {}
  const pickup = typeof fields.pickup_address === 'string' ? fields.pickup_address : null
  const dropoff = typeof fields.dropoff_address === 'string' ? fields.dropoff_address : null
  const area = typeof fields.area_label === 'string' ? fields.area_label : null
  if (pickup && dropoff) return `${pickup} → ${dropoff}`
  if (dropoff) return dropoff
  if (pickup) return pickup
  if (area) return area
  return task?.entities?.name ?? 'Ingen adress/objekt'
}

export function getIndustryTaskFocus(industryType: string | null | undefined) {
  if (industryType === 'courier') return 'pickup/dropoff, tidsfönster, fordon, kapacitet och leveransstatus'
  if (industryType === 'municipality') return 'enhet, område, kommunuppdrag, resurser och avvikelser'
  return 'uppdrag, rutt, resurser, status och avvikelser'
}

export function buildDailyOperationsSummary(params: {
  assignments: DailyAssignmentRow[]
  tasks: DailyTaskRow[]
  resourceAssignments: DailyResourceAssignmentRow[]
  deviations: DailyDeviationRow[]
  now?: Date
}): DailyOperationsSummary {
  const now = params.now ?? new Date()
  const assignedTaskIds = new Set(params.assignments.map((assignment) => assignment.task_id).filter(Boolean))
  const unassignedTasks = params.tasks.filter((task) => !assignedTaskIds.has(task.id) && !['completed', 'cancelled', 'archived'].includes(task.status ?? '')).length
  const completedAssignments = params.assignments.filter((assignment) => assignment.status === 'completed' || assignment.tasks?.status === 'completed').length
  const blockedAssignments = params.assignments.filter((assignment) => assignment.status === 'cancelled' || assignment.tasks?.status === 'blocked').length
  const activeAssignments = params.assignments.filter((assignment) => ['assigned', 'confirmed', 'draft', 'proposed'].includes(assignment.status ?? '')).length
  const resourceIssues = params.resourceAssignments.filter((assignment) => ['not_picked_up', 'replaced', 'issue_reported'].includes(assignment.status ?? '')).length + params.deviations.length
  const unconfirmedResources = params.resourceAssignments.filter((assignment) => ['planned', ''].includes(assignment.status ?? '') || !assignment.status).length
  const lateItems = params.assignments.filter((assignment) => {
    const end = new Date(assignment.planned_end_at)
    if (Number.isNaN(end.getTime())) return false
    return end.getTime() < now.getTime() && !['completed', 'cancelled'].includes(assignment.status ?? '') && assignment.tasks?.status !== 'completed'
  }).length

  return {
    totalAssignments: params.assignments.length,
    totalTasks: params.tasks.length,
    completedAssignments,
    activeAssignments,
    blockedAssignments,
    unassignedTasks,
    resourceIssues,
    unconfirmedResources,
    lateItems,
  }
}

export function groupAssignmentsByRoute(assignments: DailyAssignmentRow[]) {
  const groups = new Map<string, DailyAssignmentRow[]>()
  for (const assignment of assignments) {
    const key = assignment.staff_profile_id
      ? `staff:${assignment.staff_profile_id}`
      : assignment.team_id
        ? `team:${assignment.team_id}`
        : 'unassigned'
    groups.set(key, [...(groups.get(key) ?? []), assignment])
  }

  return Array.from(groups.entries()).map(([key, rows]) => {
    const sorted = [...rows].sort((a, b) => new Date(a.planned_start_at).getTime() - new Date(b.planned_start_at).getTime())
    const first = sorted[0]
    const title = first?.staff_profiles?.full_name ?? first?.teams?.name ?? 'Ej tilldelad'
    return {
      key,
      title,
      transportMode: first?.staff_profiles?.transport_mode ?? null,
      rows: sorted,
      startAt: sorted[0]?.planned_start_at ?? null,
      endAt: sorted[sorted.length - 1]?.planned_end_at ?? null,
      stopCount: sorted.length,
      routeText: sorted.map((assignment) => getStopLabel(assignment.tasks)).filter(Boolean).join(' → '),
    }
  }).sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''))
}

export function getTaskSortTime(task: DailyTaskRow) {
  return taskTime(task) ?? '9999-12-31T23:59:59.000Z'
}
