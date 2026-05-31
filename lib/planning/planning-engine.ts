import { conflictLevel } from '@/lib/planning/conflict-detection'
import { evaluateCandidate } from '@/lib/planning/candidate-scoring'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { summarizeCandidateEvaluation } from '@/lib/planning/risk'
import { evaluateResourceFit, mergeEvaluationWithResourceFit, resourceRequirementsForTask, type ExistingResourceAssignment, type PlanningResourceAsset, type PlanningResourceRequirement, type ResourceFitResult } from '@/lib/planning/resource-planning'
import type {
  CandidateEvaluation,
  ExistingAssignment,
  PlanningRequirement,
  PlanningShift,
  PlanningStaff,
  PlanningTask,
  StaffAbsence,
  StaffCertification,
  StaffSkill,
} from '@/lib/planning/types'

export type CreatePlanningRunInput = {
  companyId: string
  actorUserId: string
  name?: string | null
  dateFrom: string
  dateTo: string
  teamId?: string | null
  staffProfileId?: string | null
  taskTypeId?: string | null
  industryType?: string | null
  areaLabel?: string | null
  unscheduledOnly?: boolean
  includeLockedAssignments?: boolean
  sourceType?: string | null
  sourceId?: string | null
  projectId?: string | null
  projectPhaseId?: string | null
  projectWorkItemId?: string | null
}

function startOfDay(date: string) {
  return `${date}T00:00:00`
}

function endOfDay(date: string) {
  return `${date}T23:59:59`
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString()
}

function defaultStartForDate(date: string) {
  return `${date}T08:00:00`
}

function resolvePlannedPeriod(task: PlanningTask, fallbackDate: string) {
  const duration = Math.max(1, Number(task.estimated_duration_minutes ?? 60))
  const start = task.scheduled_start ?? task.time_window_start ?? defaultStartForDate(fallbackDate)
  const end = task.scheduled_end ?? (task.scheduled_start ? addMinutes(task.scheduled_start, duration) : null) ?? task.time_window_end ?? addMinutes(start, duration)
  return { plannedStartAt: start, plannedEndAt: end }
}

function isTaskInPeriod(task: PlanningTask, dateFrom: string, dateTo: string) {
  const low = new Date(startOfDay(dateFrom)).getTime()
  const high = new Date(endOfDay(dateTo)).getTime()
  const candidates = [task.scheduled_start, task.time_window_start, task.sla_due_at].filter(Boolean) as string[]
  if (candidates.length === 0) return true
  return candidates.some((value) => {
    const ms = new Date(value).getTime()
    return Number.isFinite(ms) && ms >= low && ms <= high
  })
}

function groupBy<T>(rows: T[], keyGetter: (row: T) => string | null | undefined) {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyGetter(row)
    if (!key) continue
    const current = map.get(key) ?? []
    current.push(row)
    map.set(key, current)
  }
  return map
}

function findBestShiftForStaff(shifts: PlanningShift[], staffId: string, plannedStartAt: string, plannedEndAt: string) {
  const plannedStart = new Date(plannedStartAt).getTime()
  const plannedEnd = new Date(plannedEndAt).getTime()
  return shifts.find((shift) => {
    if (shift.staff_profile_id !== staffId) return false
    return new Date(shift.starts_at).getTime() <= plannedStart && new Date(shift.ends_at).getTime() >= plannedEnd
  }) ?? shifts.find((shift) => {
    if (shift.staff_profile_id !== staffId) return false
    return new Date(shift.starts_at).getTime() < plannedEnd && new Date(shift.ends_at).getTime() > plannedStart
  }) ?? null
}

function summarizeEvaluation(evaluation: CandidateEvaluation) {
  return {
    score: evaluation.score,
    eligible: evaluation.eligible,
    conflictCount: evaluation.conflicts.length,
    hardConflictCount: evaluation.conflicts.filter((conflict) => ['hard', 'critical', 'blocked'].includes(conflict.severity)).length,
    softConflictCount: evaluation.conflicts.filter((conflict) => ['soft', 'warning'].includes(conflict.severity)).length,
  }
}

export async function createPlanningRunWithDraft(input: CreatePlanningRunInput) {
  const sourceType = input.sourceType ?? 'planning_run'
  const name = input.name?.trim() || `Planering ${input.dateFrom}${input.dateTo !== input.dateFrom ? ` – ${input.dateTo}` : ''}`

  const { data: run, error: runError } = await supabaseAdmin
    .from('planning_runs')
    .insert({
      company_id: input.companyId,
      name,
      status: 'running',
      planning_date: input.dateFrom === input.dateTo ? input.dateFrom : null,
      date_from: input.dateFrom,
      date_to: input.dateTo,
      team_id: input.teamId ?? null,
      staff_profile_id: input.staffProfileId ?? null,
      task_type_id: input.taskTypeId ?? null,
      industry_type: input.industryType ?? null,
      area_label: input.areaLabel ?? null,
      unscheduled_only: input.unscheduledOnly ?? true,
      include_locked_assignments: input.includeLockedAssignments ?? true,
      source_type: sourceType,
      source_id: input.sourceId ?? null,
      project_id: input.projectId ?? null,
      project_phase_id: input.projectPhaseId ?? null,
      project_work_item_id: input.projectWorkItemId ?? null,
      filters: {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        teamId: input.teamId ?? null,
        staffProfileId: input.staffProfileId ?? null,
        taskTypeId: input.taskTypeId ?? null,
        unscheduledOnly: input.unscheduledOnly ?? true,
      },
      started_at: new Date().toISOString(),
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })
    .select('*')
    .single()

  if (runError) throw new Error(runError.message)

  try {
    const { data: draft, error: draftError } = await supabaseAdmin
      .from('planning_drafts')
      .insert({
        company_id: input.companyId,
        planning_run_id: run.id,
        title: `Utkast · ${name}`,
        status: 'draft',
        source_type: sourceType,
        source_id: run.id,
        date_from: input.dateFrom,
        date_to: input.dateTo,
        team_id: input.teamId ?? null,
        staff_profile_id: input.staffProfileId ?? null,
        project_id: input.projectId ?? null,
        project_phase_id: input.projectPhaseId ?? null,
        project_work_item_id: input.projectWorkItemId ?? null,
        summary: 'Planeringsutkast skapat. Granska kandidater och konflikter innan publicering.',
        created_by: input.actorUserId,
        updated_by: input.actorUserId,
      })
      .select('*')
      .single()

    if (draftError) throw new Error(draftError.message)

    let taskQuery = supabaseAdmin
      .from('tasks')
      .select('id, company_id, task_type_id, entity_id, assigned_team_id, assigned_staff_id, title, priority, status, time_window_start, time_window_end, scheduled_start, scheduled_end, estimated_duration_minutes, sla_due_at, project_id, project_phase_id, project_work_item_id')
      .eq('company_id', input.companyId)
      .is('archived_at', null)
      .limit(100)

    if (input.unscheduledOnly ?? true) taskQuery = taskQuery.eq('status', 'unscheduled')
    if (input.teamId) taskQuery = taskQuery.eq('assigned_team_id', input.teamId)
    if (input.staffProfileId) taskQuery = taskQuery.eq('assigned_staff_id', input.staffProfileId)
    if (input.taskTypeId) taskQuery = taskQuery.eq('task_type_id', input.taskTypeId)
    if (input.projectId) taskQuery = taskQuery.eq('project_id', input.projectId)
    if (input.projectPhaseId) taskQuery = taskQuery.eq('project_phase_id', input.projectPhaseId)
    if (input.projectWorkItemId) taskQuery = taskQuery.eq('project_work_item_id', input.projectWorkItemId)

    const [{ data: taskRows, error: tasksError }, { data: staffRows }, { data: shiftRows }, { data: requirementRows }, { data: skillRows }, { data: certRows }, { data: absenceRows }, { data: assignmentRows }, { data: continuityRows }, { data: resourceRequirementRows }, { data: resourceAssetRows }, { data: resourceAssignmentRows }] = await Promise.all([
      taskQuery,
      supabaseAdmin
        .from('staff_profiles')
        .select('id, company_id, full_name, status, primary_team_id, transport_mode')
        .eq('company_id', input.companyId)
        .eq('status', 'active')
        .is('archived_at', null)
        .order('full_name')
        .limit(250),
      supabaseAdmin
        .from('shifts')
        .select('id, company_id, staff_profile_id, team_id, title, shift_date, starts_at, ends_at, status, capacity_minutes, planned_minutes, remaining_minutes, planning_locked, transport_mode')
        .eq('company_id', input.companyId)
        .is('archived_at', null)
        .gte('shift_date', input.dateFrom)
        .lte('shift_date', input.dateTo)
        .limit(500),
      supabaseAdmin
        .from('task_requirements')
        .select('id, task_id, requirement_kind, skill_id, certification_id, required_value, minimum_level, is_hard_requirement, description, skills(name), certifications(name)')
        .eq('company_id', input.companyId)
        .is('archived_at', null)
        .limit(500),
      supabaseAdmin
        .from('staff_skills')
        .select('id, staff_profile_id, skill_id, level')
        .eq('company_id', input.companyId)
        .is('archived_at', null)
        .limit(1000),
      supabaseAdmin
        .from('staff_certifications')
        .select('id, staff_profile_id, certification_id, status, expires_at')
        .eq('company_id', input.companyId)
        .is('archived_at', null)
        .limit(1000),
      supabaseAdmin
        .from('absences')
        .select('id, staff_profile_id, starts_at, ends_at, reason')
        .eq('company_id', input.companyId)
        .eq('affects_planning', true)
        .is('archived_at', null)
        .lt('starts_at', endOfDay(input.dateTo))
        .gt('ends_at', startOfDay(input.dateFrom))
        .limit(500),
      supabaseAdmin
        .from('task_assignments')
        .select('id, task_id, staff_profile_id, team_id, shift_id, planned_start_at, planned_end_at, status, is_locked')
        .eq('company_id', input.companyId)
        .is('archived_at', null)
        .in('status', ['draft', 'proposed', 'assigned', 'confirmed'])
        .lt('planned_start_at', endOfDay(input.dateTo))
        .gt('planned_end_at', startOfDay(input.dateFrom))
        .limit(500),
      supabaseAdmin
        .from('continuity_preferences')
        .select('entity_id, staff_profile_id, team_id, preference_type')
        .eq('company_id', input.companyId)
        .is('archived_at', null)
        .limit(500),
      supabaseAdmin
        .from('resource_requirements')
        .select('id, company_id, owner_type, owner_id, resource_asset_id, resource_type_id, requirement_label, quantity, is_hard_requirement, description, allow_substitution, resource_assets(id, name), resource_types(id, name)')
        .eq('company_id', input.companyId)
        .is('archived_at', null)
        .limit(1000),
      supabaseAdmin
        .from('resource_assets')
        .select('id, company_id, resource_type_id, name, status, allow_overlapping, requires_return, location_label')
        .eq('company_id', input.companyId)
        .is('archived_at', null)
        .limit(1000),
      supabaseAdmin
        .from('planning_resource_assignments')
        .select('id, resource_asset_id, actual_resource_asset_id, planned_staff_profile_id, planned_team_id, planned_start_at, planned_end_at, status, planning_draft_item_id, task_id')
        .eq('company_id', input.companyId)
        .is('archived_at', null)
        .lt('planned_start_at', endOfDay(input.dateTo))
        .gt('planned_end_at', startOfDay(input.dateFrom))
        .limit(1000),
    ])

    if (tasksError) throw new Error(tasksError.message)

    const tasks = ((taskRows ?? []) as PlanningTask[]).filter((task) => isTaskInPeriod(task, input.dateFrom, input.dateTo))
    const staff = (staffRows ?? []) as PlanningStaff[]
    const shifts = (shiftRows ?? []) as PlanningShift[]
    const requirementsByTask = groupBy((requirementRows ?? []) as Array<PlanningRequirement & { task_id?: string | null }>, (row) => row.task_id)
    const skillsByStaff = groupBy((skillRows ?? []) as StaffSkill[], (row) => row.staff_profile_id)
    const certsByStaff = groupBy((certRows ?? []) as StaffCertification[], (row) => row.staff_profile_id)
    const absencesByStaff = groupBy((absenceRows ?? []) as StaffAbsence[], (row) => row.staff_profile_id)
    const existingAssignments = (assignmentRows ?? []) as ExistingAssignment[]
    const continuity = continuityRows ?? []
    const resourceRequirements = (resourceRequirementRows ?? []) as PlanningResourceRequirement[]
    const resourceAssets = (resourceAssetRows ?? []) as PlanningResourceAsset[]
    const existingResourceAssignments = (resourceAssignmentRows ?? []) as ExistingResourceAssignment[]
    const plannedResourceAssignments: ExistingResourceAssignment[] = []

    let itemCount = 0
    let candidateCount = 0
    let hardConflictCount = 0
    let softConflictCount = 0

    for (const task of tasks) {
      const { plannedStartAt, plannedEndAt } = resolvePlannedPeriod(task, input.dateFrom)
      const eligibleStaff = staff.filter((person) => {
        if (input.staffProfileId && person.id !== input.staffProfileId) return false
        if (input.teamId && person.primary_team_id !== input.teamId) return false
        if (task.assigned_staff_id && person.id !== task.assigned_staff_id) return false
        if (task.assigned_team_id && person.primary_team_id !== task.assigned_team_id) return false
        return true
      })

      const taskResourceRequirements = resourceRequirementsForTask(task, resourceRequirements)
      const candidates = eligibleStaff.slice(0, 25).map((person) => {
        const shift = findBestShiftForStaff(shifts, person.id, plannedStartAt, plannedEndAt)
        const requirements = (requirementsByTask.get(task.id) ?? []) as PlanningRequirement[]
        const continuityMatch = continuity.some((row: any) => row.entity_id === task.entity_id && row.staff_profile_id === person.id && row.preference_type !== 'avoid')
        const areaMatch = Boolean(task.assigned_team_id && person.primary_team_id === task.assigned_team_id)
        const baseEvaluation = evaluateCandidate({
          task,
          staff: person,
          teamId: person.primary_team_id ?? null,
          shift,
          plannedStartAt,
          plannedEndAt,
          requirements,
          staffSkills: skillsByStaff.get(person.id) ?? [],
          staffCertifications: certsByStaff.get(person.id) ?? [],
          absences: absencesByStaff.get(person.id) ?? [],
          existingAssignments,
          continuityMatch,
          areaMatch,
        })
        const resourceFit = evaluateResourceFit({
          requirements: taskResourceRequirements,
          resources: resourceAssets,
          existingAssignments: [...existingResourceAssignments, ...plannedResourceAssignments],
          plannedStartAt,
          plannedEndAt,
          staffProfileId: person.id,
          teamId: person.primary_team_id ?? null,
        })
        const evaluation = mergeEvaluationWithResourceFit(baseEvaluation, resourceFit)
        const riskSummary = summarizeCandidateEvaluation(evaluation)
        return { person, shift, evaluation, resourceFit, riskSummary }
      }).sort((a, b) => b.evaluation.score - a.evaluation.score)

      const best = candidates.find((candidate) => candidate.evaluation.eligible) ?? candidates[0] ?? null
      const topCandidates = candidates.slice(0, 5)
      let candidateId: string | null = null
      let evaluation = best?.evaluation ?? null
      const selectedResourceFit: ResourceFitResult | null = best?.resourceFit ?? null
      const candidateRowIds: string[] = []

      for (const candidate of topCandidates) {
        const { data: candidateRow, error: candidateError } = await supabaseAdmin
          .from('assignment_candidates')
          .insert({
            company_id: input.companyId,
            planning_run_id: run.id,
            planning_draft_id: draft.id,
            task_id: task.id,
            staff_profile_id: candidate.person.id,
            team_id: candidate.person.primary_team_id ?? null,
            shift_id: candidate.shift?.id ?? null,
            planned_start_at: plannedStartAt,
            planned_end_at: plannedEndAt,
            score: candidate.evaluation.score,
            eligible: candidate.evaluation.eligible,
            risk_score: candidate.riskSummary.riskScore,
            blocking_count: candidate.riskSummary.blockingCount,
            warning_count: candidate.riskSummary.warningCount,
            info_count: candidate.riskSummary.infoCount,
            rule_summary: candidate.riskSummary as any,
            rejection_reason: candidate.evaluation.rejectionReason,
            explanation: candidate.evaluation.explanation,
            source_type: 'planning_run',
            source_id: run.id,
            project_id: input.projectId ?? null,
            project_phase_id: input.projectPhaseId ?? null,
            project_work_item_id: input.projectWorkItemId ?? null,
            metadata: { ...summarizeEvaluation(candidate.evaluation), rank: candidateRowIds.length + 1, selectedForDraft: candidate === best, resourceFit: candidate.resourceFit.summary, riskSummary: candidate.riskSummary },
          })
          .select('id')
          .single()

        if (candidateError) throw new Error(candidateError.message)
        candidateRowIds.push(candidateRow.id)
        candidateCount += 1
        if (candidate === best) candidateId = candidateRow.id

        if (candidate.evaluation.breakdown.length) {
          const { error: scoreError } = await supabaseAdmin.from('candidate_score_breakdown').insert(candidate.evaluation.breakdown.map((part) => ({
            company_id: input.companyId,
            candidate_id: candidateRow.id,
            score_key: part.scoreKey,
            label: part.label,
            points: part.points,
            max_points: part.maxPoints ?? null,
            is_blocking: part.isBlocking ?? false,
            message: part.message ?? null,
            metadata: part.metadata ?? {},
          })))
          if (scoreError) throw new Error(scoreError.message)
        }
      }

      const draftRiskSummary = evaluation ? summarizeCandidateEvaluation(evaluation) : { riskScore: 100, blockingCount: 1, warningCount: 0, infoCount: 0, conflictCount: 1, canPublishWithoutOverride: false, requiresOverride: true, highestSeverity: 'hard', summary: 'Inga kandidater kunde hittas' }

      const { data: item, error: itemError } = await supabaseAdmin
        .from('planning_draft_items')
        .insert({
          company_id: input.companyId,
          planning_draft_id: draft.id,
          planning_run_id: run.id,
          task_id: task.id,
          candidate_id: candidateId,
          staff_profile_id: best?.person.id ?? null,
          team_id: best?.person.primary_team_id ?? task.assigned_team_id ?? null,
          shift_id: best?.shift?.id ?? null,
          planned_start_at: plannedStartAt,
          planned_end_at: plannedEndAt,
          status: 'proposed',
          score: evaluation?.score ?? 0,
          eligible: evaluation?.eligible ?? false,
          conflict_level: evaluation ? conflictLevel(evaluation.conflicts) : 'hard',
          risk_score: draftRiskSummary.riskScore,
          blocking_count: draftRiskSummary.blockingCount,
          warning_count: draftRiskSummary.warningCount,
          info_count: draftRiskSummary.infoCount,
          rule_summary: draftRiskSummary as any,
          rejection_reason: evaluation?.rejectionReason ?? 'Inga kandidater kunde hittas.',
          explanation: evaluation?.explanation ?? 'Inga kandidater kunde hittas för uppdraget.',
          source_type: 'planning_run',
          source_id: run.id,
          project_id: input.projectId ?? null,
          project_phase_id: input.projectPhaseId ?? null,
          project_work_item_id: input.projectWorkItemId ?? null,
          metadata: evaluation ? { ...summarizeEvaluation(evaluation), resourceFit: selectedResourceFit?.summary ?? null, riskSummary: draftRiskSummary } : { eligible: false, reason: 'no_candidates', riskSummary: draftRiskSummary },
          sort_order: itemCount + 1,
        })
        .select('id')
        .single()

      if (itemError) throw new Error(itemError.message)
      itemCount += 1

      if (candidateRowIds.length) {
        await supabaseAdmin.from('assignment_candidates').update({ planning_draft_item_id: item.id }).in('id', candidateRowIds)
      }

      if (selectedResourceFit?.selectedAssignments.length) {
        const { error: resourceAssignmentError } = await supabaseAdmin.from('planning_resource_assignments').insert(selectedResourceFit.selectedAssignments.map((assignment) => ({
          company_id: input.companyId,
          planning_run_id: run.id,
          planning_draft_id: draft.id,
          planning_draft_item_id: item.id,
          task_id: task.id,
          resource_requirement_id: assignment.resourceRequirementId,
          resource_asset_id: assignment.resourceAssetId,
          resource_type_id: assignment.resourceTypeId,
          planned_staff_profile_id: best?.person.id ?? null,
          planned_team_id: best?.person.primary_team_id ?? task.assigned_team_id ?? null,
          shift_id: best?.shift?.id ?? null,
          planned_start_at: plannedStartAt,
          planned_end_at: plannedEndAt,
          assignment_kind: 'planned',
          status: 'planned',
          note: assignment.requirementLabel,
          created_by: input.actorUserId,
          updated_by: input.actorUserId,
        })))
        if (resourceAssignmentError) throw new Error(resourceAssignmentError.message)
        for (const assignment of selectedResourceFit.selectedAssignments) {
          plannedResourceAssignments.push({
            id: `${item.id}-${assignment.resourceAssetId}`,
            resource_asset_id: assignment.resourceAssetId,
            actual_resource_asset_id: null,
            planned_staff_profile_id: best?.person.id ?? null,
            planned_team_id: best?.person.primary_team_id ?? task.assigned_team_id ?? null,
            planned_start_at: plannedStartAt,
            planned_end_at: plannedEndAt,
            status: 'planned',
            planning_draft_item_id: item.id,
            task_id: task.id,
          })
        }
      }

      const conflicts = evaluation?.conflicts ?? [{ conflictType: 'no_candidates', severity: 'hard' as const, message: 'Inga kandidater kunde hittas.', details: {} }]
      hardConflictCount += conflicts.filter((conflict) => ['hard', 'critical', 'blocked'].includes(conflict.severity)).length
      softConflictCount += conflicts.filter((conflict) => ['soft', 'warning'].includes(conflict.severity)).length

      if (conflicts.length) {
        const { error: conflictError } = await supabaseAdmin.from('planning_conflicts').insert(conflicts.map((conflict) => ({
          company_id: input.companyId,
          planning_run_id: run.id,
          planning_draft_id: draft.id,
          planning_draft_item_id: item.id,
          candidate_id: candidateId,
          task_id: task.id,
          staff_profile_id: best?.person.id ?? null,
          team_id: best?.person.primary_team_id ?? null,
          shift_id: best?.shift?.id ?? null,
          conflict_type: conflict.conflictType,
          severity: conflict.severity,
          status: 'open',
          message: conflict.message,
          details: { ...(conflict.details ?? {}), riskSummary: draftRiskSummary },
          project_id: input.projectId ?? null,
          project_phase_id: input.projectPhaseId ?? null,
          project_work_item_id: input.projectWorkItemId ?? null,
        })))
        if (conflictError) throw new Error(conflictError.message)
      }
    }

    await supabaseAdmin.from('planning_drafts').update({
      summary_json: { tasks: tasks.length, draftItems: itemCount, candidates: candidateCount, hardConflicts: hardConflictCount, softConflicts: softConflictCount },
      conflict_summary: { hard: hardConflictCount, soft: softConflictCount },
    }).eq('id', draft.id).eq('company_id', input.companyId)

    await supabaseAdmin.from('planning_runs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      summary: { tasks: tasks.length, draftItems: itemCount, candidates: candidateCount, hardConflicts: hardConflictCount, softConflicts: softConflictCount, draftId: draft.id },
      updated_by: input.actorUserId,
    }).eq('id', run.id).eq('company_id', input.companyId)

    return { runId: run.id as string, draftId: draft.id as string, taskCount: tasks.length, draftItemCount: itemCount, candidateCount, hardConflictCount, softConflictCount }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Okänt fel i planeringsmotor.'
    await supabaseAdmin.from('planning_runs').update({ status: 'failed', error_message: message, completed_at: new Date().toISOString(), updated_by: input.actorUserId }).eq('id', run.id).eq('company_id', input.companyId)
    throw error
  }
}

export async function recalculateShiftAssignmentCapacity(companyId: string, shiftId: string) {
  const [{ data: shift }, { data: assignments }] = await Promise.all([
    supabaseAdmin.from('shifts').select('id, capacity_minutes').eq('id', shiftId).eq('company_id', companyId).maybeSingle(),
    supabaseAdmin
      .from('task_assignments')
      .select('planned_start_at, planned_end_at')
      .eq('company_id', companyId)
      .eq('shift_id', shiftId)
      .is('archived_at', null)
      .in('status', ['assigned', 'confirmed', 'completed']),
  ])

  if (!shift) return

  const plannedMinutes = (assignments ?? []).reduce((sum: number, assignment: any) => {
    const diff = new Date(assignment.planned_end_at).getTime() - new Date(assignment.planned_start_at).getTime()
    return sum + (Number.isFinite(diff) ? Math.max(0, Math.round(diff / 60000)) : 0)
  }, 0)
  const capacity = Math.max(0, Number(shift.capacity_minutes ?? 0))

  await supabaseAdmin.from('shifts').update({ planned_minutes: plannedMinutes, remaining_minutes: Math.max(0, capacity - plannedMinutes) }).eq('id', shiftId).eq('company_id', companyId)
}
