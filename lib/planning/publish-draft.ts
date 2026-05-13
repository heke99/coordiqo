import { recalculateShiftAssignmentCapacity } from '@/lib/planning/planning-engine'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type PublishPlanningDraftInput = {
  companyId: string
  actorUserId: string
  draftId: string
  selectedDraftItemIds?: string[]
  lockAssignments?: boolean
}

export async function publishPlanningDraft(input: PublishPlanningDraftInput) {
  const { data: draft, error: draftError } = await supabaseAdmin
    .from('planning_drafts')
    .select('*')
    .eq('id', input.draftId)
    .eq('company_id', input.companyId)
    .is('archived_at', null)
    .maybeSingle()

  if (draftError) throw new Error(draftError.message)
  if (!draft) throw new Error('Planeringsutkastet kunde inte hittas.')
  if (draft.status === 'published') throw new Error('Planeringsutkastet är redan publicerat.')

  let itemQuery = supabaseAdmin
    .from('planning_draft_items')
    .select('*')
    .eq('company_id', input.companyId)
    .eq('planning_draft_id', input.draftId)
    .is('archived_at', null)
    .in('status', ['proposed', 'accepted', 'draft'])
    .order('sort_order')

  if (input.selectedDraftItemIds?.length) itemQuery = itemQuery.in('id', input.selectedDraftItemIds)

  const { data: items, error: itemError } = await itemQuery
  if (itemError) throw new Error(itemError.message)

  const publishableItems = (items ?? []).filter((item: any) => item.eligible && item.staff_profile_id && item.planned_start_at && item.planned_end_at && item.conflict_level !== 'hard' && item.conflict_level !== 'blocked')
  const skippedCount = (items ?? []).length - publishableItems.length
  const assignmentIds: string[] = []
  const touchedShiftIds = new Set<string>()

  for (const item of publishableItems as any[]) {
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('task_assignments')
      .insert({
        company_id: input.companyId,
        task_id: item.task_id,
        staff_profile_id: item.staff_profile_id,
        team_id: item.team_id,
        shift_id: item.shift_id,
        planning_run_id: item.planning_run_id,
        planning_draft_id: item.planning_draft_id,
        planning_draft_item_id: item.id,
        planned_start_at: item.planned_start_at,
        planned_end_at: item.planned_end_at,
        status: 'assigned',
        source_type: item.source_type ?? 'planning_run',
        source_id: item.source_id ?? item.planning_run_id,
        project_id: item.project_id ?? null,
        project_phase_id: item.project_phase_id ?? null,
        project_work_item_id: item.project_work_item_id ?? null,
        is_locked: input.lockAssignments ?? false,
        locked_reason: input.lockAssignments ? 'Låst vid publicering av planeringsutkast.' : null,
        explanation: item.explanation,
        metadata: item.metadata ?? {},
        created_by: input.actorUserId,
        updated_by: input.actorUserId,
        published_by: input.actorUserId,
      })
      .select('id')
      .single()

    if (assignmentError) throw new Error(assignmentError.message)
    assignmentIds.push(assignment.id)

    await supabaseAdmin
      .from('planning_draft_items')
      .update({ status: 'published', assignment_id: assignment.id })
      .eq('id', item.id)
      .eq('company_id', input.companyId)

    await supabaseAdmin
      .from('tasks')
      .update({
        assigned_staff_id: item.staff_profile_id,
        assigned_team_id: item.team_id,
        scheduled_start: item.planned_start_at,
        scheduled_end: item.planned_end_at,
        status: 'assigned',
        updated_by: input.actorUserId,
      })
      .eq('id', item.task_id)
      .eq('company_id', input.companyId)

    if (item.shift_id) touchedShiftIds.add(item.shift_id)
  }

  for (const shiftId of touchedShiftIds) {
    await recalculateShiftAssignmentCapacity(input.companyId, shiftId)
  }

  const { data: publication, error: publicationError } = await supabaseAdmin
    .from('planning_publications')
    .insert({
      company_id: input.companyId,
      planning_run_id: draft.planning_run_id,
      planning_draft_id: draft.id,
      status: skippedCount > 0 ? 'partial' : 'published',
      selected_draft_item_ids: (publishableItems as any[]).map((item) => item.id),
      published_assignment_ids: assignmentIds,
      skipped_count: skippedCount,
      summary: { published: assignmentIds.length, skipped: skippedCount },
      published_by: input.actorUserId,
    })
    .select('id')
    .single()

  if (publicationError) throw new Error(publicationError.message)

  const remainingOpen = await supabaseAdmin
    .from('planning_draft_items')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', input.companyId)
    .eq('planning_draft_id', input.draftId)
    .is('archived_at', null)
    .in('status', ['proposed', 'accepted', 'draft'])

  const draftFullyPublished = (remainingOpen.count ?? 0) === 0
  await supabaseAdmin
    .from('planning_drafts')
    .update({ status: draftFullyPublished ? 'published' : 'reviewing', published_by: input.actorUserId, published_at: new Date().toISOString() })
    .eq('id', input.draftId)
    .eq('company_id', input.companyId)

  if (draft.planning_run_id && draftFullyPublished) {
    await supabaseAdmin
      .from('planning_runs')
      .update({ status: 'published' })
      .eq('id', draft.planning_run_id)
      .eq('company_id', input.companyId)
  }

  return { publicationId: publication.id as string, assignmentIds, skippedCount }
}
