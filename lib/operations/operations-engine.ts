import { coordinateFromCustomFields, coordinateFromValues } from '@/lib/routing/coordinates'
import { buildRouteMetricSummary } from '@/lib/routing/route-metrics'
import type { RouteMetricSummary, RoutingWaypoint } from '@/lib/routing/types'

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
  location_label?: string | null
  location_latitude?: number | string | null
  location_longitude?: number | string | null
  geocode_status?: string | null
  entities?: { name?: string | null; entity_addresses?: Array<{ label?: string | null; street?: string | null; postal_code?: string | null; city?: string | null; latitude?: number | string | null; longitude?: number | string | null; formatted_address?: string | null; is_primary?: boolean | null }> | null } | null
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

export function getTaskCoordinate(task: DailyTaskRow | null | undefined) {
  if (!task) return null
  const direct = coordinateFromValues(task.location_latitude, task.location_longitude, task.location_label ?? task.title, 'tasks.location')
  if (direct) return direct

  const fromFields = coordinateFromCustomFields(task.custom_fields, task.location_label ?? task.title)
  if (fromFields) return fromFields

  const addresses = task.entities?.entity_addresses ?? []
  const primary = addresses.find((address) => address.is_primary) ?? addresses[0]
  if (primary) {
    const labelParts = [primary.formatted_address, primary.street, primary.postal_code, primary.city].filter(Boolean)
    const fromAddress = coordinateFromValues(primary.latitude, primary.longitude, labelParts.join(', ') || task.entities?.name || task.title, 'entity_addresses')
    if (fromAddress) return fromAddress
  }

  return null
}

export function buildAssignmentWaypoint(assignment: DailyAssignmentRow, index = 0): RoutingWaypoint | null {
  const coordinate = getTaskCoordinate(assignment.tasks)
  if (!coordinate) return null
  return {
    id: assignment.id,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    label: assignment.tasks?.title ?? coordinate.label ?? `Stopp ${index + 1}`,
    source: coordinate.source,
    kind: assignment.tasks?.task_types?.name ?? null,
    status: assignment.status ?? assignment.tasks?.status ?? null,
    plannedAt: assignment.planned_start_at,
    href: assignment.task_id ? `/tasks/${assignment.task_id}` : null,
  }
}

export function buildTaskWaypoint(task: DailyTaskRow): RoutingWaypoint | null {
  const coordinate = getTaskCoordinate(task)
  if (!coordinate) return null
  return {
    id: task.id,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    label: task.title ?? coordinate.label ?? 'Uppdrag',
    source: coordinate.source,
    kind: task.task_types?.name ?? null,
    status: task.status ?? null,
    plannedAt: task.scheduled_start ?? task.time_window_start ?? null,
    href: `/tasks/${task.id}`,
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
      waypoints: sorted.map((assignment, index) => buildAssignmentWaypoint(assignment, index)).filter(Boolean) as RoutingWaypoint[],
      metrics: buildRouteMetricSummary(sorted.map((assignment, index) => buildAssignmentWaypoint(assignment, index)).filter(Boolean) as RoutingWaypoint[]),
    }
  }).sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''))
}

export function getTaskSortTime(task: DailyTaskRow) {
  return taskTime(task) ?? '9999-12-31T23:59:59.000Z'
}

export function summarizeRouteWaypoints(waypoints: RoutingWaypoint[]): RouteMetricSummary {
  return buildRouteMetricSummary(waypoints)
}
