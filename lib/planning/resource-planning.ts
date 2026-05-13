import type { CandidateEvaluation, CandidateScorePart, PlanningConflict, PlanningTask } from '@/lib/planning/types'

export type ResourceRequirementOwnerType = 'entity' | 'task' | 'project' | 'project_work_item' | 'planning_draft_item' | 'manual'

export type PlanningResourceRequirement = {
  id: string
  company_id?: string | null
  owner_type: ResourceRequirementOwnerType | string
  owner_id: string
  resource_asset_id?: string | null
  resource_type_id?: string | null
  requirement_label?: string | null
  quantity?: number | null
  is_hard_requirement?: boolean | null
  description?: string | null
  allow_substitution?: boolean | null
  resource_assets?: { id?: string | null; name?: string | null } | null
  resource_types?: { id?: string | null; name?: string | null } | null
}

export type PlanningResourceAsset = {
  id: string
  company_id?: string | null
  resource_type_id?: string | null
  name: string
  status?: string | null
  allow_overlapping?: boolean | null
  requires_return?: boolean | null
  location_label?: string | null
}

export type ExistingResourceAssignment = {
  id: string
  resource_asset_id?: string | null
  actual_resource_asset_id?: string | null
  planned_staff_profile_id?: string | null
  planned_team_id?: string | null
  planned_start_at?: string | null
  planned_end_at?: string | null
  status?: string | null
  planning_draft_item_id?: string | null
  task_id?: string | null
}

export type SelectedResourceAssignment = {
  resourceRequirementId: string
  resourceAssetId: string
  resourceTypeId: string | null
  requirementLabel: string
  assignmentKind: 'planned' | 'manual'
}

export type ResourceFitResult = {
  scoreAdjustment: number
  breakdown: CandidateScorePart[]
  conflicts: PlanningConflict[]
  selectedAssignments: SelectedResourceAssignment[]
  summary: {
    required: number
    selected: number
    missing: number
    labels: string[]
  }
}

function overlaps(aStart?: string | null, aEnd?: string | null, bStart?: string | null, bEnd?: string | null) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(aEnd).getTime() > new Date(bStart).getTime()
}

function requirementName(requirement: PlanningResourceRequirement) {
  return requirement.requirement_label
    ?? requirement.resource_assets?.name
    ?? requirement.resource_types?.name
    ?? requirement.description
    ?? 'Resurskrav'
}

function severityForRequirement(requirement: PlanningResourceRequirement) {
  return requirement.is_hard_requirement === false ? 'warning' : 'hard'
}

function activeBlockingStatuses(status?: string | null) {
  return !['returned', 'cancelled', 'not_picked_up'].includes(status ?? 'planned')
}

export function resourceRequirementsForTask(task: PlanningTask, requirements: PlanningResourceRequirement[]) {
  return requirements.filter((requirement) => {
    if (requirement.owner_type === 'task' && requirement.owner_id === task.id) return true
    if (requirement.owner_type === 'entity' && task.entity_id && requirement.owner_id === task.entity_id) return true
    if (requirement.owner_type === 'project' && task.project_id && requirement.owner_id === task.project_id) return true
    if (requirement.owner_type === 'project_work_item' && task.project_work_item_id && requirement.owner_id === task.project_work_item_id) return true
    return false
  })
}

function isAvailableAsset(params: {
  asset: PlanningResourceAsset
  plannedStartAt: string
  plannedEndAt: string
  staffProfileId: string | null
  existingAssignments: ExistingResourceAssignment[]
  excludeDraftItemId?: string | null
  reservedInCandidate: Set<string>
}) {
  if (params.asset.status && ['maintenance', 'lost', 'inactive', 'archived'].includes(params.asset.status)) {
    return { ok: false, sameStaffReuse: false, reason: `${params.asset.name} är markerad som ${params.asset.status}.` }
  }

  if (params.asset.allow_overlapping || params.reservedInCandidate.has(params.asset.id)) {
    return { ok: true, sameStaffReuse: false, reason: null }
  }

  for (const assignment of params.existingAssignments) {
    if (params.excludeDraftItemId && assignment.planning_draft_item_id === params.excludeDraftItemId) continue
    if (!activeBlockingStatuses(assignment.status)) continue
    const assignedAssetId = assignment.actual_resource_asset_id ?? assignment.resource_asset_id
    if (assignedAssetId !== params.asset.id) continue
    if (!overlaps(params.plannedStartAt, params.plannedEndAt, assignment.planned_start_at, assignment.planned_end_at)) continue

    if (params.staffProfileId && assignment.planned_staff_profile_id === params.staffProfileId) {
      return { ok: true, sameStaffReuse: true, reason: null }
    }

    return { ok: false, sameStaffReuse: false, reason: `${params.asset.name} är redan planerad under samma tid.` }
  }

  return { ok: true, sameStaffReuse: false, reason: null }
}

export function evaluateResourceFit(params: {
  requirements: PlanningResourceRequirement[]
  resources: PlanningResourceAsset[]
  existingAssignments: ExistingResourceAssignment[]
  plannedStartAt: string
  plannedEndAt: string
  staffProfileId?: string | null
  teamId?: string | null
  excludeDraftItemId?: string | null
}) {
  const conflicts: PlanningConflict[] = []
  const breakdown: CandidateScorePart[] = []
  const selectedAssignments: SelectedResourceAssignment[] = []
  const reservedInCandidate = new Set<string>()
  let scoreAdjustment = 0
  let missing = 0

  if (params.requirements.length === 0) {
    return {
      scoreAdjustment: 0,
      breakdown: [{ scoreKey: 'resource_requirements', label: 'Resurskrav', points: 0, maxPoints: null, message: 'Uppdraget har inga resurskrav.', isBlocking: false }],
      conflicts,
      selectedAssignments,
      summary: { required: 0, selected: 0, missing: 0, labels: [] },
    }
  }

  for (const requirement of params.requirements) {
    const label = requirementName(requirement)
    const quantity = Math.max(1, Math.round(Number(requirement.quantity ?? 1)))
    const severity = severityForRequirement(requirement)

    for (let index = 0; index < quantity; index += 1) {
      let chosen: PlanningResourceAsset | null = null
      let sameStaffReuse = false
      let failureReason: string | null = null

      const exactId = requirement.resource_asset_id ?? null
      const candidates = exactId
        ? params.resources.filter((asset) => asset.id === exactId)
        : params.resources.filter((asset) => asset.resource_type_id && asset.resource_type_id === requirement.resource_type_id)

      for (const asset of candidates) {
        const availability = isAvailableAsset({
          asset,
          plannedStartAt: params.plannedStartAt,
          plannedEndAt: params.plannedEndAt,
          staffProfileId: params.staffProfileId ?? null,
          existingAssignments: params.existingAssignments,
          excludeDraftItemId: params.excludeDraftItemId ?? null,
          reservedInCandidate,
        })
        if (!availability.ok) {
          failureReason = availability.reason
          continue
        }
        chosen = asset
        sameStaffReuse = availability.sameStaffReuse
        break
      }

      if (!chosen) {
        missing += 1
        conflicts.push({
          conflictType: exactId ? 'required_resource_unavailable' : 'required_resource_type_unavailable',
          severity,
          message: failureReason ?? `Resurskrav saknar tillgänglig resurs: ${label}.`,
          details: { requirementId: requirement.id, resourceAssetId: exactId, resourceTypeId: requirement.resource_type_id ?? null, quantityIndex: index + 1 },
        })
        breakdown.push({
          scoreKey: 'resource_available',
          label: `Resurs: ${label}`,
          points: severity === 'hard' ? -30 : -10,
          maxPoints: null,
          isBlocking: severity === 'hard',
          message: failureReason ?? 'Ingen ledig resurs matchar kravet.',
          metadata: { requirementId: requirement.id },
        })
        scoreAdjustment += severity === 'hard' ? -30 : -10
        continue
      }

      reservedInCandidate.add(chosen.id)
      selectedAssignments.push({
        resourceRequirementId: requirement.id,
        resourceAssetId: chosen.id,
        resourceTypeId: chosen.resource_type_id ?? requirement.resource_type_id ?? null,
        requirementLabel: label,
        assignmentKind: 'planned',
      })
      const points = exactId ? 14 : 10
      scoreAdjustment += sameStaffReuse ? points + 6 : points
      breakdown.push({
        scoreKey: sameStaffReuse ? 'resource_reuse_same_staff' : 'resource_available',
        label: `Resurs: ${label}`,
        points: sameStaffReuse ? points + 6 : points,
        maxPoints: sameStaffReuse ? points + 6 : points,
        isBlocking: false,
        message: sameStaffReuse ? `${chosen.name} är redan hos samma personal under dagen.` : `${chosen.name} kan användas för uppdraget.`,
        metadata: { requirementId: requirement.id, resourceAssetId: chosen.id },
      })
    }
  }

  return {
    scoreAdjustment,
    breakdown,
    conflicts,
    selectedAssignments,
    summary: {
      required: params.requirements.reduce((sum, requirement) => sum + Math.max(1, Math.round(Number(requirement.quantity ?? 1))), 0),
      selected: selectedAssignments.length,
      missing,
      labels: selectedAssignments.map((assignment) => assignment.requirementLabel),
    },
  }
}

export function mergeEvaluationWithResourceFit(evaluation: CandidateEvaluation, resourceFit: ResourceFitResult): CandidateEvaluation {
  const conflicts = [...evaluation.conflicts, ...resourceFit.conflicts]
  const hardBlocked = conflicts.some((conflict) => ['hard', 'critical', 'blocked'].includes(conflict.severity))
  const score = evaluation.score + resourceFit.scoreAdjustment
  const resourceText = resourceFit.summary.required
    ? ` Resurser: ${resourceFit.summary.selected}/${resourceFit.summary.required} matchade.`
    : ' Inga resurskrav.'
  const rejectionReason = hardBlocked
    ? conflicts.find((conflict) => ['hard', 'critical', 'blocked'].includes(conflict.severity))?.message ?? 'Hård konflikt blockerar kandidaten.'
    : null

  return {
    score,
    eligible: !hardBlocked,
    rejectionReason,
    explanation: `${evaluation.explanation}${resourceText}`,
    breakdown: [...evaluation.breakdown, ...resourceFit.breakdown],
    conflicts,
  }
}
