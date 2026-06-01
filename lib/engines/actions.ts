'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { assertCompanyPermission } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { buildAiPromptContext, callLangflow } from '@/lib/ai/orchestration'
import { syncNotionKnowledgeSource } from '@/lib/knowledge/notion-sync'
import { sendSmsWithTwilio } from '@/lib/messaging/twilio'
import { createFallbackOptimization, runVroomOptimization, type OptimizationJob, type OptimizationVehicle } from '@/lib/optimization/vroom'
import { logAuditEvent } from '@/lib/platform/audit'
import { supabaseAdmin } from '@/lib/supabase/admin'

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

function numberValue(formData: FormData, key: string, fallback = 0) {
  const raw = value(formData, key)
  if (!raw) return fallback
  const parsed = Number(raw.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findFirstStringByKey(value: unknown, keys: string[]): string | null {
  if (typeof value === 'string') return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstStringByKey(item, keys)
      if (found) return found
    }
    return null
  }
  if (!isRecord(value)) return null

  for (const key of keys) {
    const entry = value[key]
    if (typeof entry === 'string' && entry.trim() !== '') return entry
  }

  for (const entry of Object.values(value)) {
    const found = findFirstStringByKey(entry, keys)
    if (found) return found
  }
  return null
}

function extractLangflowText(value: unknown): string {
  if (typeof value === 'string') return value
  return findFirstStringByKey(value, ['text', 'message', 'content', 'output', 'response']) ?? JSON.stringify(value)
}

function parseJsonObjectFromText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return isRecord(parsed) ? parsed : null
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1))
      return isRecord(parsed) ? parsed : null
    } catch {
      return null
    }
  }
}

function firstSuggestedAction(parsed: Record<string, unknown> | null) {
  const actions = parsed?.suggested_actions
  if (!Array.isArray(actions)) return null
  const first = actions[0]
  return isRecord(first) ? first : null
}

async function requireCompanyRole(minimumRole: Parameters<typeof assertCompanyPermission>[1], label: string) {
  const auth = await requireAuth()
  if (!auth.membership) redirect('/setup')
  assertCompanyPermission(auth.membership.companyRole, minimumRole, label)
  return auth
}

async function audit(companyId: string | null, actorUserId: string, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await logAuditEvent({
    companyId,
    actorUserId,
    action,
    entityType,
    entityId,
    metadata,
  })
}

type TaskForOptimization = {
  id: string
  title: string
  priority: string | null
  location_latitude: number | null
  location_longitude: number | null
  estimated_duration_minutes: number | null
  time_window_start: string | null
  time_window_end: string | null
}

type StaffForOptimization = {
  id: string
  full_name: string
}

function priorityScore(priority: string | null) {
  if (priority === 'urgent') return 100
  if (priority === 'high') return 75
  if (priority === 'low') return 20
  return 50
}

export async function runOptimizationAction(formData: FormData) {
  const auth = await requireCompanyRole('planner', 'att köra optimering')
  const companyId = auth.membership!.companyId
  const planLabel = value(formData, 'plan_label') ?? 'Plan A'
  const requestedProvider = value(formData, 'provider') ?? (process.env.VROOM_API_URL ? 'vroom' : 'fallback')
  const provider = requestedProvider === 'vroom' && process.env.VROOM_API_URL ? 'vroom' : 'fallback'

  const [{ data: tasks }, { data: staff }] = await Promise.all([
    supabaseAdmin
      .from('tasks')
      .select('id, title, priority, location_latitude, location_longitude, estimated_duration_minutes, time_window_start, time_window_end')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .in('status', ['new', 'open', 'planned', 'draft', 'assigned'])
      .order('time_window_start', { ascending: true })
      .limit(80),
    supabaseAdmin
      .from('staff_profiles')
      .select('id, full_name')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .is('archived_at', null)
      .order('full_name')
      .limit(20),
  ])

  const taskRows = (tasks ?? []) as TaskForOptimization[]
  const staffRows = (staff ?? []) as StaffForOptimization[]
  const jobs: OptimizationJob[] = taskRows.map((task) => ({
    id: task.id,
    taskId: task.id,
    latitude: task.location_latitude,
    longitude: task.location_longitude,
    serviceSeconds: Math.max(1, task.estimated_duration_minutes ?? 60) * 60,
    priority: priorityScore(task.priority),
    timeWindowStart: task.time_window_start,
    timeWindowEnd: task.time_window_end,
  }))
  const vehicles: OptimizationVehicle[] = (staffRows.length ? staffRows : [{ id: 'unassigned', full_name: 'Planering' }]).map((member) => ({
    id: member.id,
    staffProfileId: member.id === 'unassigned' ? null : member.id,
  }))
  const result = provider === 'vroom'
    ? await runVroomOptimization({ jobs, vehicles })
    : createFallbackOptimization({ jobs, vehicles })

  const { data: run, error: runError } = await supabaseAdmin
    .from('optimization_runs')
    .insert({
      company_id: companyId,
      provider,
      plan_label: planLabel,
      status: result.status,
      completed_at: result.status === 'completed' ? new Date().toISOString() : null,
      blocking_count: result.unassigned.length,
      warning_count: result.unassigned.length,
      summary: {
        provider: result.provider,
        taskCount: taskRows.length,
        plannedStops: result.stops.length,
        unassigned: result.unassigned.length,
      },
      created_by: auth.userId,
    })
    .select('id')
    .single()
  if (runError) throw new Error(runError.message)

  if (result.stops.length) {
    const items = result.stops.map((stop) => ({
      company_id: companyId,
      optimization_run_id: run.id,
      task_id: stop.jobId,
      staff_profile_id: stop.vehicleId,
      item_type: 'job',
      stop_order: stop.stopOrder,
      travel_seconds: stop.travelSeconds,
      distance_meters: stop.distanceMeters,
      waiting_seconds: stop.waitingSeconds,
      status: 'proposed',
      rule_summary: { source: 'coordiqo_fallback_optimizer' },
    }))
    const { error } = await supabaseAdmin.from('optimization_run_items').insert(items)
    if (error) throw new Error(error.message)
  }

  if (result.unassigned.length) {
    const { error } = await supabaseAdmin.from('optimization_unassigned_jobs').insert(result.unassigned.map((job) => ({
      company_id: companyId,
      optimization_run_id: run.id,
      task_id: job.jobId,
      reason_code: job.reason,
      severity: 'warning',
    })))
    if (error) throw new Error(error.message)
  }

  if (result.providerPayload) {
    await supabaseAdmin.from('optimization_provider_payloads').insert({
      company_id: companyId,
      optimization_run_id: run.id,
      provider: result.provider,
      payload_kind: result.status === 'failed' ? 'error' : 'response',
      payload: result.providerPayload,
      redacted: true,
    })
  }

  await supabaseAdmin.from('optimization_metrics').insert([
    { company_id: companyId, optimization_run_id: run.id, metric_key: 'total_travel_seconds', metric_value: result.metrics.totalTravelSeconds, unit: 'seconds' },
    { company_id: companyId, optimization_run_id: run.id, metric_key: 'total_distance_meters', metric_value: result.metrics.totalDistanceMeters, unit: 'meters' },
  ])

  await audit(companyId, auth.userId, 'optimization.run_completed', 'optimization_run', run.id, { planLabel, provider, taskCount: taskRows.length })
  revalidatePath('/optimization')
  revalidatePath('/planning')
}

export async function approveOptimizationRunAction(formData: FormData) {
  const auth = await requireCompanyRole('planner', 'att godkänna optimering')
  const id = value(formData, 'id')
  const reason = value(formData, 'approval_reason')
  if (!id) throw new Error('Optimerings-id saknas.')

  const { error } = await supabaseAdmin
    .from('optimization_runs')
    .update({ status: 'approved', approved_by: auth.userId, approved_at: new Date().toISOString(), approval_reason: reason })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)

  await audit(auth.membership!.companyId, auth.userId, 'optimization.approved', 'optimization_run', id, { reason })
  revalidatePath('/optimization')
}

export async function createProjectCalculationRunAction(formData: FormData) {
  const auth = await requireCompanyRole('planner', 'att skapa projektkalkyl')
  const companyId = auth.membership!.companyId
  const projectId = value(formData, 'project_id')
  if (!projectId) throw new Error('Projekt saknas.')

  const [{ data: project }, { data: workItems }, { count }] = await Promise.all([
    supabaseAdmin.from('projects').select('id, name, project_template_id, currency, estimated_effort_minutes, estimated_material_cost, estimated_total_cost').eq('id', projectId).eq('company_id', companyId).maybeSingle(),
    supabaseAdmin.from('project_work_items').select('id, title, phase_key, quantity, unit_label, estimated_effort_minutes, estimated_material_cost, estimated_total_cost, sort_order').eq('company_id', companyId).eq('project_id', projectId).is('archived_at', null).order('sort_order'),
    supabaseAdmin.from('project_calculation_runs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('project_id', projectId),
  ])
  if (!project) throw new Error('Projektet kunde inte hittas.')

  const items = (workItems ?? []) as Array<{
    id: string
    title: string
    phase_key: string | null
    quantity: number | null
    unit_label: string | null
    estimated_effort_minutes: number | null
    estimated_material_cost: number | null
    estimated_total_cost: number | null
    sort_order: number | null
  }>
  const laborRate = numberValue(formData, 'labor_rate', 550)
  const marginPercent = numberValue(formData, 'margin_percent', 30)
  const riskMarkupPercent = numberValue(formData, 'risk_markup_percent', 10)
  const estimatedMinutes = items.reduce((sum, item) => sum + Number(item.estimated_effort_minutes ?? 0), 0) || Number(project.estimated_effort_minutes ?? 0)
  const laborCost = (estimatedMinutes / 60) * laborRate
  const materialCost = items.reduce((sum, item) => sum + Number(item.estimated_material_cost ?? 0), 0) || Number(project.estimated_material_cost ?? 0)
  const internalCost = laborCost + materialCost
  const riskMarkup = internalCost * (riskMarkupPercent / 100)
  const recommendedPrice = (internalCost + riskMarkup) / Math.max(0.01, 1 - marginPercent / 100)
  const version = Number(count ?? 0) + 1

  const { data: run, error } = await supabaseAdmin.from('project_calculation_runs').insert({
    company_id: companyId,
    project_id: projectId,
    project_template_id: project.project_template_id,
    version,
    status: 'calculated',
    source: 'automation',
    currency: project.currency ?? auth.membership!.currency ?? 'SEK',
    estimated_minutes: Math.round(estimatedMinutes),
    internal_cost: Math.round(internalCost),
    recommended_price: Math.round(recommendedPrice),
    price_low: Math.round(recommendedPrice * 0.9),
    price_high: Math.round(recommendedPrice * 1.15),
    margin_amount: Math.round(recommendedPrice - internalCost - riskMarkup),
    margin_percent: marginPercent,
    risk_markup_percent: riskMarkupPercent,
    summary: { laborRate, materialCost, laborCost, riskMarkup, source: 'coordiqo_calculation_engine' },
    created_by: auth.userId,
  }).select('id').single()
  if (error) throw new Error(error.message)

  if (items.length) {
    const { error: itemError } = await supabaseAdmin.from('project_calculation_items').insert(items.map((item) => ({
      company_id: companyId,
      project_calculation_run_id: run.id,
      project_work_item_id: item.id,
      phase_key: item.phase_key,
      item_key: item.id,
      title: item.title,
      line_type: 'work_item',
      quantity: item.quantity ?? 1,
      unit_label: item.unit_label,
      total_minutes: item.estimated_effort_minutes ?? 0,
      total_cost: item.estimated_total_cost ?? 0,
      total_price: Math.round(Number(item.estimated_total_cost ?? 0) * (recommendedPrice / Math.max(1, internalCost))),
      sort_order: item.sort_order ?? 100,
    })))
    if (itemError) throw new Error(itemError.message)
  }

  await supabaseAdmin.from('project_cost_lines').insert([
    { company_id: companyId, project_id: projectId, project_calculation_run_id: run.id, cost_type: 'labor', description: 'Arbetstid', quantity: estimatedMinutes / 60, unit_label: 'h', unit_cost: laborRate, total_cost: Math.round(laborCost) },
    { company_id: companyId, project_id: projectId, project_calculation_run_id: run.id, cost_type: 'material', description: 'Material och externa kostnader', quantity: 1, unit_label: 'summa', unit_cost: Math.round(materialCost), total_cost: Math.round(materialCost) },
    { company_id: companyId, project_id: projectId, project_calculation_run_id: run.id, cost_type: 'risk', description: 'Riskpåslag', quantity: riskMarkupPercent, unit_label: '%', unit_cost: Math.round(riskMarkup), total_cost: Math.round(riskMarkup) },
  ])

  await supabaseAdmin.from('project_price_lines').insert({
    company_id: companyId,
    project_id: projectId,
    project_calculation_run_id: run.id,
    price_type: 'recommended',
    description: 'Rekommenderat kundpris',
    quantity: 1,
    unit_label: 'projekt',
    unit_price: Math.round(recommendedPrice),
    total_price: Math.round(recommendedPrice),
  })

  await supabaseAdmin.from('projects').update({
    calculation_status: 'calculated',
    calculation_summary: { latestCalculationRunId: run.id, recommendedPrice: Math.round(recommendedPrice), internalCost: Math.round(internalCost) },
    estimated_total_cost: Math.round(internalCost),
  }).eq('id', projectId).eq('company_id', companyId)

  await audit(companyId, auth.userId, 'project.calculation_created', 'project_calculation_run', run.id, { projectId, version, recommendedPrice })
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
}

export async function approveProjectCalculationRunAction(formData: FormData) {
  const auth = await requireCompanyRole('planner', 'att godkänna projektkalkyl')
  const id = value(formData, 'id')
  const projectId = value(formData, 'project_id')
  const reason = value(formData, 'approval_reason')
  if (!id || !projectId) throw new Error('Kalkyl och projekt krävs.')

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin.from('project_calculation_runs').update({ status: 'approved', approved_by: auth.userId, approved_at: now, approval_reason: reason }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await supabaseAdmin.from('projects').update({ approved_calculation_run_id: id, calculation_status: 'approved', status: 'planned' }).eq('id', projectId).eq('company_id', auth.membership!.companyId)
  await audit(auth.membership!.companyId, auth.userId, 'project.calculation_approved', 'project_calculation_run', id, { projectId, reason })
  revalidatePath(`/projects/${projectId}`)
}

export async function createProjectActualsAction(formData: FormData) {
  const auth = await requireCompanyRole('planner', 'att skapa efterkalkyl')
  const companyId = auth.membership!.companyId
  const projectId = value(formData, 'project_id')
  if (!projectId) throw new Error('Projekt saknas.')

  const actualMinutes = Math.round(numberValue(formData, 'actual_hours', 0) * 60)
  const actualCost = numberValue(formData, 'actual_cost', 0)
  const actualBillingAmount = numberValue(formData, 'actual_billing_amount', 0)
  const margin = actualBillingAmount - actualCost

  const { data: existing } = await supabaseAdmin.from('project_actuals').select('id').eq('company_id', companyId).eq('project_id', projectId).maybeSingle()
  const payload = {
    company_id: companyId,
    project_id: projectId,
    status: 'submitted',
    actual_completed_at: value(formData, 'actual_completed_at') ? new Date(value(formData, 'actual_completed_at')!).toISOString() : new Date().toISOString(),
    actual_minutes: actualMinutes,
    actual_cost: actualCost,
    actual_billing_amount: actualBillingAmount,
    actual_margin_amount: margin,
    deadline_status: value(formData, 'deadline_status') ?? 'on_time',
    customer_satisfaction: Math.max(1, Math.min(5, Math.round(numberValue(formData, 'customer_satisfaction', 3)))),
    summary: { notes: value(formData, 'notes') },
    created_by: auth.userId,
  }
  const result = existing?.id
    ? await supabaseAdmin.from('project_actuals').update(payload).eq('id', existing.id).eq('company_id', companyId).select('id').single()
    : await supabaseAdmin.from('project_actuals').insert(payload).select('id').single()
  if (result.error) throw new Error(result.error.message)

  await supabaseAdmin.from('project_learning_events').insert({
    company_id: companyId,
    project_id: projectId,
    event_type: 'actuals_submitted',
    recommendation: margin < 0 ? 'Projektet hade negativ marginal. Granska kalkylregler, riskpåslag och faktisk tidsåtgång.' : 'Efterkalkyl sparad. Jämför liknande projekt innan regler ändras.',
    confidence: 0.7,
    status: 'pending',
  })
  await supabaseAdmin.from('projects').update({ actuals_status: 'submitted', status: 'completed' }).eq('id', projectId).eq('company_id', companyId)
  await audit(companyId, auth.userId, 'project.actuals_submitted', 'project_actuals', result.data.id, { projectId, actualCost, margin })
  revalidatePath(`/projects/${projectId}`)
}

export async function createMobileExecutionEventAction(formData: FormData) {
  const auth = await requireCompanyRole('staff', 'att rapportera mobil händelse')
  const companyId = auth.membership!.companyId
  const taskId = value(formData, 'task_id')
  const assignmentId = value(formData, 'task_assignment_id')
  const eventType = value(formData, 'event_type')
  if (!taskId || !eventType) throw new Error('Uppdrag och händelse krävs.')

  const { data: task } = await supabaseAdmin.from('tasks').select('id, status').eq('id', taskId).eq('company_id', companyId).maybeSingle()
  if (!task) throw new Error('Uppdraget kunde inte hittas.')

  const { data: staffProfile } = await supabaseAdmin.from('staff_profiles').select('id').eq('company_id', companyId).eq('membership_id', auth.membership!.membershipId).is('archived_at', null).maybeSingle()
  const { data: event, error } = await supabaseAdmin.from('mobile_execution_events').insert({
    company_id: companyId,
    task_id: taskId,
    task_assignment_id: assignmentId,
    staff_profile_id: staffProfile?.id ?? null,
    event_type: eventType,
    notes: value(formData, 'notes'),
    latitude: numberValue(formData, 'latitude', 0) || null,
    longitude: numberValue(formData, 'longitude', 0) || null,
    created_by: auth.userId,
  }).select('id').single()
  if (error) throw new Error(error.message)

  const nextStatus = eventType === 'completed' ? 'completed' : eventType === 'started' ? 'in_progress' : eventType === 'arrived' ? 'arrived' : eventType === 'on_way' ? 'on_way' : null
  if (nextStatus) {
    await supabaseAdmin.from('tasks').update({ status: nextStatus, updated_by: auth.userId }).eq('id', taskId).eq('company_id', companyId)
    await supabaseAdmin.from('task_status_history').insert({ company_id: companyId, task_id: taskId, old_status: task.status, new_status: nextStatus, changed_by: auth.userId, reason: eventType })
  }
  await audit(companyId, auth.userId, 'mobile.execution_event', 'mobile_execution_event', event.id, { taskId, eventType })
  revalidatePath('/staff/mobile/day')
  revalidatePath(`/tasks/${taskId}`)
}

export async function saveMobileChecklistResponseAction(formData: FormData) {
  const auth = await requireCompanyRole('staff', 'att svara på checklista')
  const companyId = auth.membership!.companyId
  const taskId = value(formData, 'task_id')
  const itemKey = value(formData, 'item_key')
  if (!taskId || !itemKey) throw new Error('Uppdrag och checklistpunkt krävs.')
  const { data: task } = await supabaseAdmin.from('tasks').select('id').eq('id', taskId).eq('company_id', companyId).maybeSingle()
  if (!task) throw new Error('Uppdraget kunde inte hittas.')
  const { data: staffProfile } = await supabaseAdmin.from('staff_profiles').select('id').eq('company_id', companyId).eq('membership_id', auth.membership!.membershipId).is('archived_at', null).maybeSingle()
  const responseValue = formData.get('response_value') === 'on' ? true : value(formData, 'response_value') ?? true
  const { error } = await supabaseAdmin.from('mobile_checklist_responses').insert({
    company_id: companyId,
    task_id: taskId,
    staff_profile_id: staffProfile?.id ?? null,
    checklist_key: value(formData, 'checklist_key') ?? 'default_task_completion',
    item_key: itemKey,
    response_value: responseValue,
    answered_by: auth.userId,
  })
  if (error) throw new Error(error.message)
  await audit(companyId, auth.userId, 'mobile.checklist_answered', 'task', taskId, { itemKey })
  revalidatePath('/staff/mobile/day')
}

export async function decideAiSuggestionAction(formData: FormData) {
  const auth = await requireCompanyRole('planner', 'att granska AI-förslag')
  const id = value(formData, 'id')
  const decision = value(formData, 'decision')
  const reason = value(formData, 'reason')
  if (!id || !decision) throw new Error('AI-förslag och beslut krävs.')
  if (!['approved', 'rejected', 'ignored'].includes(decision)) throw new Error('Ogiltigt beslut.')
  const { error } = await supabaseAdmin.from('ai_decision_logs').update({
    human_decision: decision,
    validation_status: decision,
    decision_reason: reason,
    decided_by: auth.userId,
    decided_at: new Date().toISOString(),
  }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'ai.suggestion_decided', 'ai_decision_log', id, { decision, reason })
  revalidatePath('/ai/suggestions')
}

export async function createDeviationAction(formData: FormData) {
  const auth = await requireCompanyRole('staff', 'att rapportera avvikelse')
  const companyId = auth.membership!.companyId
  const title = value(formData, 'title')
  if (!title) throw new Error('Rubrik krävs.')
  const { data, error } = await supabaseAdmin.from('deviations').insert({
    company_id: companyId,
    title,
    description: value(formData, 'description'),
    priority: value(formData, 'priority') ?? 'normal',
    status: 'open',
    task_id: value(formData, 'task_id'),
    project_id: value(formData, 'project_id'),
    customer_impact: formData.get('customer_impact') === 'on',
    route_impact: formData.get('route_impact') === 'on',
    billing_impact: formData.get('billing_impact') === 'on',
    sla_risk: formData.get('sla_risk') === 'on',
    created_by: auth.userId,
  }).select('id').single()
  if (error) throw new Error(error.message)
  await supabaseAdmin.from('deviation_events').insert({ company_id: companyId, deviation_id: data.id, event_type: 'created', to_status: 'open', created_by: auth.userId })
  await audit(companyId, auth.userId, 'deviation.created', 'deviation', data.id, { title })
  revalidatePath('/deviations')
}

export async function updateDeviationStatusAction(formData: FormData) {
  const auth = await requireCompanyRole('team_lead', 'att uppdatera avvikelse')
  const id = value(formData, 'id')
  const status = value(formData, 'status')
  if (!id || !status) throw new Error('Avvikelse och status krävs.')
  const { data: deviation } = await supabaseAdmin.from('deviations').select('id, status').eq('id', id).eq('company_id', auth.membership!.companyId).maybeSingle()
  if (!deviation) throw new Error('Avvikelsen kunde inte hittas.')
  const { error } = await supabaseAdmin.from('deviations').update({ status, resolution: value(formData, 'resolution'), resolved_at: status === 'resolved' || status === 'closed' ? new Date().toISOString() : null }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await supabaseAdmin.from('deviation_events').insert({ company_id: auth.membership!.companyId, deviation_id: id, event_type: 'status_changed', from_status: deviation.status, to_status: status, comment: value(formData, 'resolution'), created_by: auth.userId })
  await audit(auth.membership!.companyId, auth.userId, 'deviation.status_updated', 'deviation', id, { status })
  revalidatePath('/deviations')
}

export async function createChatChannelAction(formData: FormData) {
  const auth = await requireCompanyRole('team_lead', 'att skapa kanal')
  const name = value(formData, 'name')
  if (!name) throw new Error('Kanalnamn krävs.')
  const { data, error } = await supabaseAdmin.from('chat_channels').insert({
    company_id: auth.membership!.companyId,
    name,
    description: value(formData, 'description'),
    channel_type: value(formData, 'channel_type') ?? 'group',
    created_by: auth.userId,
  }).select('id').single()
  if (error) throw new Error(error.message)
  await supabaseAdmin.from('chat_channel_members').insert({ company_id: auth.membership!.companyId, chat_channel_id: data.id, membership_id: auth.membership!.membershipId, user_id: auth.userId, role: 'owner' })
  await audit(auth.membership!.companyId, auth.userId, 'chat.channel_created', 'chat_channel', data.id, { name })
  revalidatePath('/chat')
}

export async function createChatMessageAction(formData: FormData) {
  const auth = await requireCompanyRole('staff', 'att skriva i chatt')
  const channelId = value(formData, 'chat_channel_id')
  const body = value(formData, 'body')
  if (!channelId || !body) throw new Error('Kanal och meddelande krävs.')
  const { data: channel } = await supabaseAdmin.from('chat_channels').select('id').eq('id', channelId).eq('company_id', auth.membership!.companyId).maybeSingle()
  if (!channel) throw new Error('Kanalen kunde inte hittas.')
  const { data, error } = await supabaseAdmin.from('chat_messages').insert({
    company_id: auth.membership!.companyId,
    chat_channel_id: channelId,
    sender_user_id: auth.userId,
    body,
    importance: value(formData, 'importance') ?? 'normal',
  }).select('id').single()
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'chat.message_created', 'chat_message', data.id, { channelId, importance: value(formData, 'importance') ?? 'normal' })
  revalidatePath('/chat')
}

export async function createAiDecisionSupportRunAction(formData: FormData) {
  const auth = await requireCompanyRole('planner', 'att skapa AI-beslutsstöd')
  const companyId = auth.membership!.companyId
  const runType = value(formData, 'run_type') ?? 'operations_summary'
  const prompt = value(formData, 'prompt') ?? ''
  const promptContext = buildAiPromptContext({ companyId, locale: auth.membership!.locale, runType, input: { prompt } })
  const langflowResult = await callLangflow({ companyId, locale: auth.membership!.locale, runType, input: { prompt } })
  const outputText = extractLangflowText(langflowResult.output)
  const parsedOutput = parseJsonObjectFromText(outputText)
  const action = firstSuggestedAction(parsedOutput)
  const summary = typeof parsedOutput?.summary === 'string'
    ? parsedOutput.summary
    : langflowResult.status === 'not_configured'
      ? 'AI-tjänsten är inte färdigkopplad. Beslutsstöd skapades lokalt.'
      : outputText.slice(0, 500)
  const classification = typeof parsedOutput?.classification === 'string' ? parsedOutput.classification : runType
  const suggestedAction = typeof action?.type === 'string' ? action.type : 'review'
  const decisionReason = typeof action?.reason === 'string' ? action.reason : null
  const { data, error } = await supabaseAdmin.from('ai_runs').insert({
    company_id: companyId,
    run_type: runType,
    locale: auth.membership!.locale,
    status: langflowResult.status,
    input_summary: prompt,
    output_summary: summary,
    completed_at: langflowResult.status === 'not_configured' ? null : new Date().toISOString(),
    created_by: auth.userId,
    metadata: {
      promptContext,
      langflow: {
        provider: langflowResult.provider,
        status: langflowResult.status,
        locale: langflowResult.locale,
      },
      output: parsedOutput ?? outputText,
    },
  }).select('id').single()
  if (error) throw new Error(error.message)
  await supabaseAdmin.from('ai_decision_logs').insert({
    company_id: companyId,
    ai_run_id: data.id,
    decision_type: classification,
    suggested_action: suggestedAction,
    validation_status: langflowResult.status === 'completed' ? 'pending' : 'provider_not_ready',
    decision_reason: decisionReason,
    metadata: parsedOutput ?? { outputText },
  })
  await audit(companyId, auth.userId, 'ai.decision_support_created', 'ai_run', data.id, { runType, classification, langflowStatus: langflowResult.status })
  revalidatePath('/integrations')
}

export async function createBillingUnderlayAction(formData: FormData) {
  const auth = await requireCompanyRole('operations_manager', 'att skapa faktureringsunderlag')
  const companyId = auth.membership!.companyId
  const periodStart = value(formData, 'period_start')
  const periodEnd = value(formData, 'period_end')
  if (!periodStart || !periodEnd) throw new Error('Period krävs.')

  const { data: tasks } = await supabaseAdmin.from('tasks').select('id, title, estimated_duration_minutes').eq('company_id', companyId).is('archived_at', null).gte('scheduled_start', `${periodStart}T00:00:00`).lte('scheduled_start', `${periodEnd}T23:59:59`).limit(250)
  const taskRows = (tasks ?? []) as Array<{ id: string; title: string; estimated_duration_minutes: number | null }>
  const hourlyPrice = numberValue(formData, 'hourly_price', 650)
  const subtotal = taskRows.reduce((sum, task) => sum + (Number(task.estimated_duration_minutes ?? 60) / 60) * hourlyPrice, 0)
  const vat = subtotal * 0.25

  const { data: underlay, error } = await supabaseAdmin.from('billing_underlays').insert({
    company_id: companyId,
    period_start: periodStart,
    period_end: periodEnd,
    status: 'draft',
    currency: auth.membership!.currency ?? 'SEK',
    subtotal_amount: Math.round(subtotal),
    vat_amount: Math.round(vat),
    total_amount: Math.round(subtotal + vat),
    created_by: auth.userId,
  }).select('id').single()
  if (error) throw new Error(error.message)

  if (taskRows.length) {
    await supabaseAdmin.from('billing_underlay_items').insert(taskRows.map((task) => ({
      company_id: companyId,
      billing_underlay_id: underlay.id,
      item_type: 'task_time',
      description: task.title,
      task_id: task.id,
      quantity: Number(task.estimated_duration_minutes ?? 60) / 60,
      unit_label: 'h',
      unit_price: hourlyPrice,
      total_price: Math.round((Number(task.estimated_duration_minutes ?? 60) / 60) * hourlyPrice),
    })))
  }

  await audit(companyId, auth.userId, 'billing.underlay_created', 'billing_underlay', underlay.id, { periodStart, periodEnd, itemCount: taskRows.length })
  revalidatePath('/reports')
}

export async function saveIntegrationSettingAction(formData: FormData) {
  const auth = await requireCompanyRole('company_admin', 'att uppdatera integrationer')
  const provider = value(formData, 'provider')
  if (!provider) throw new Error('Provider krävs.')
  const { data, error } = await supabaseAdmin.from('integration_settings').insert({
    company_id: auth.membership!.companyId,
    scope: 'company',
    provider,
    status: value(formData, 'status') ?? 'inactive',
    config: {
      label: value(formData, 'label'),
      baseUrl: value(formData, 'base_url'),
      locale: auth.membership!.locale,
    },
    secret_ref: value(formData, 'secret_ref'),
    created_by: auth.userId,
  }).select('id').single()
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'integration.setting_saved', 'integration_setting', data.id, { provider })
  revalidatePath('/integrations')
}

export async function syncNotionKnowledgeAction() {
  const auth = await requireCompanyRole('operations_manager', 'att synka kunskapskälla')
  const result = await syncNotionKnowledgeSource({
    companyId: auth.membership!.companyId,
    actorUserId: auth.userId,
    locale: auth.membership!.locale,
  })
  await audit(auth.membership!.companyId, auth.userId, 'knowledge.notion_sync', 'knowledge_source', auth.membership!.companyId, result)
  revalidatePath('/integrations')
}

export async function createExternalSmsMessageAction(formData: FormData) {
  const auth = await requireCompanyRole('planner', 'att skicka kundmeddelande')
  const companyId = auth.membership!.companyId
  const to = value(formData, 'to')
  const body = value(formData, 'body')
  if (!to || !body) throw new Error('Telefonnummer och meddelande krävs.')

  const { data: thread, error: threadError } = await supabaseAdmin.from('message_threads').insert({
    company_id: companyId,
    channel_type: 'sms',
    subject: value(formData, 'subject') ?? 'Kundmeddelande',
    customer_label: to,
    status: 'open',
    created_by: auth.userId,
  }).select('id').single()
  if (threadError) throw new Error(threadError.message)

  const delivery = await sendSmsWithTwilio({ to, body })
  const { data: message, error } = await supabaseAdmin.from('external_messages').insert({
    company_id: companyId,
    message_thread_id: thread.id,
    direction: 'outbound',
    channel_type: 'sms',
    to_address: to,
    body,
    status: delivery.status,
    provider_message_id: delivery.providerMessageId,
    requires_approval: false,
    approved_by: auth.userId,
    approved_at: new Date().toISOString(),
    created_by: auth.userId,
    sent_at: delivery.status === 'sent' ? new Date().toISOString() : null,
    metadata: { provider: delivery.provider, detail: delivery.detail },
  }).select('id').single()
  if (error) throw new Error(error.message)

  await supabaseAdmin.from('message_delivery_logs').insert({
    company_id: companyId,
    external_message_id: message.id,
    provider: delivery.provider,
    status: delivery.status,
    provider_response: delivery.providerResponse ?? {},
  })
  await audit(companyId, auth.userId, 'message.sms_created', 'external_message', message.id, { to, status: delivery.status })
  revalidatePath('/messages')
}

