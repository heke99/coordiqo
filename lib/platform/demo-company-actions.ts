'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { trackProductEvent } from '@/lib/analytics/product-events'
import { requirePlatformAdmin } from '@/lib/auth/guards'
import { toFriendlyError } from '@/lib/errors/friendly-error'
import { allCompanyCoreModules } from '@/lib/industry/config'
import { getIndustryProfile } from '@/lib/industry/registry'
import { logAuditEvent } from '@/lib/platform/audit'
import { supabaseAdmin } from '@/lib/supabase/admin'

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

const FIRST_NAMES = ['Anna', 'Johan', 'Maria', 'Erik', 'Sara', 'Lars', 'Emma', 'Karl', 'Elin', 'Oskar', 'Ingrid', 'Nils', 'Karin', 'Per', 'Sofia', 'Anders', 'Linnea', 'Mats', 'Ida', 'Gustav']
const LAST_NAMES = ['Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson', 'Svensson', 'Gustafsson', 'Pettersson', 'Jonsson', 'Jansson', 'Hansson', 'Bengtsson', 'Lindberg', 'Jakobsson', 'Magnusson', 'Lindström', 'Axelsson']
const STREETS = ['Storgatan', 'Kungsgatan', 'Drottninggatan', 'Skolvägen', 'Parkvägen', 'Industrigatan', 'Hamngatan', 'Björkvägen', 'Ekvägen', 'Ringvägen']
const CITIES = ['Malmö', 'Lund', 'Helsingborg', 'Göteborg', 'Stockholm', 'Uppsala', 'Västerås', 'Örebro']

const SIZE_PRESETS: Record<string, { staff: number; tasks: number; days: number }> = {
  small: { staff: 4, tasks: 20, days: 5 },
  medium: { staff: 10, tasks: 60, days: 10 },
  large: { staff: 25, tasks: 200, days: 21 },
}

function pick<T>(list: readonly T[], index: number): T {
  return list[index % list.length]
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function createDemoCompanyAction(formData: FormData) {
  const auth = await requirePlatformAdmin()

  const industryCode = value(formData, 'industry_type') ?? 'other'
  const size = value(formData, 'size') ?? 'medium'
  const preset = SIZE_PRESETS[size] ?? SIZE_PRESETS.medium
  const staffCount = Math.min(Number(value(formData, 'staff_count') ?? preset.staff) || preset.staff, 100)
  const taskCount = Math.min(Number(value(formData, 'task_count') ?? preset.tasks) || preset.tasks, 1000)
  const days = Math.min(Number(value(formData, 'days') ?? preset.days) || preset.days, 60)

  const profile = await getIndustryProfile(industryCode)
  const suffix = new Date().toISOString().slice(5, 10).replace('-', '')
  const companyName = `Demo — ${profile.nameSv} ${suffix}`
  const slug = `demo-${profile.code.replace(/_/g, '-')}-${Math.random().toString(36).slice(2, 7)}`

  // 1. Company (clearly marked as demo).
  const { data: company, error: companyError } = await supabaseAdmin.from('companies').insert({
    name: companyName,
    slug,
    status: 'active',
    lifecycle_status: 'active',
    industry_type: profile.code,
    operational_model: profile.defaultOperationalModel,
    language_code: 'sv',
    timezone: profile.defaultTimezone,
    is_demo: true,
    contract_status: 'demo',
    package_code: 'demo',
    approved_by: auth.userId,
    approved_at: new Date().toISOString(),
  }).select('id').single()
  if (companyError) throw toFriendlyError(companyError)
  const companyId = company.id

  // 2. Settings, runtime config, defaults, onboarding (idempotent).
  await supabaseAdmin.from('company_settings').upsert({
    company_id: companyId,
    active_modules: allCompanyCoreModules(),
    ui_label_set: profile.code,
    locale: 'sv',
    timezone: profile.defaultTimezone,
    currency: profile.defaultCurrency,
  }, { onConflict: 'company_id' })
  await supabaseAdmin.rpc('ensure_company_industry_defaults', { target_company_id: companyId }).throwOnError()
  await supabaseAdmin.from('company_onboarding_sessions').upsert({
    company_id: companyId,
    status: 'completed',
    current_step: 'finish',
    completed_steps: profile.onboardingTemplate.map((step) => step.key),
    settings: { demo: true },
    created_by: auth.userId,
    completed_by: auth.userId,
    completed_at: new Date().toISOString(),
  }, { onConflict: 'company_id' })

  // 3. Teams.
  const { data: team } = await supabaseAdmin.from('teams').insert({
    company_id: companyId, name: 'Team Nord', code: 'NORD', status: 'active', description: 'Demodata',
  }).select('id').single()
  const { data: team2 } = await supabaseAdmin.from('teams').insert({
    company_id: companyId, name: 'Team Syd', code: 'SYD', status: 'active', description: 'Demodata',
  }).select('id').single()
  const teamIds = [team?.id, team2?.id].filter(Boolean) as string[]

  // 4. Staff.
  const staffRows = Array.from({ length: staffCount }, (_, index) => ({
    company_id: companyId,
    primary_team_id: teamIds[index % teamIds.length] ?? null,
    full_name: `${pick(FIRST_NAMES, index)} ${pick(LAST_NAMES, index + 3)}`,
    email: `demo.personal${index + 1}@example.com`,
    status: 'active',
    transport_mode: index % 4 === 0 ? 'bike' : 'car',
    notes: 'Demodata',
  }))
  const { data: staff } = await supabaseAdmin.from('staff_profiles').insert(staffRows).select('id')
  const staffIds = (staff ?? []).map((row) => row.id)

  // 5. Entities based on the company's entity types.
  const { data: entityTypes } = await supabaseAdmin.from('entity_types').select('id, label_singular').eq('company_id', companyId).eq('is_active', true).limit(5)
  const entityCount = Math.max(5, Math.round(taskCount / 4))
  const entityRows = Array.from({ length: entityCount }, (_, index) => ({
    company_id: companyId,
    entity_type_id: entityTypes?.[index % Math.max(entityTypes.length, 1)]?.id ?? null,
    name: `${pick(FIRST_NAMES, index + 7)} ${pick(LAST_NAMES, index)} — ${pick(STREETS, index)} ${randomBetween(1, 99)}`,
    status: 'active',
    priority: 'normal',
    summary: `Demodata (${pick(CITIES, index)})`,
    custom_fields: { demo: true },
  })).filter((row) => row.entity_type_id)
  const { data: entities } = entityRows.length
    ? await supabaseAdmin.from('entities').insert(entityRows).select('id')
    : { data: [] as Array<{ id: string }> }
  const entityIds = (entities ?? []).map((row) => row.id)

  // 6. Resources based on the company's resource types.
  const { data: resourceTypes } = await supabaseAdmin.from('resource_types').select('id, name').eq('company_id', companyId).limit(8)
  const resourceRows = (resourceTypes ?? []).flatMap((resourceType, typeIndex) =>
    Array.from({ length: 2 }, (_, unitIndex) => ({
      company_id: companyId,
      resource_type_id: resourceType.id,
      name: `${resourceType.name} ${typeIndex + 1}${String.fromCharCode(65 + unitIndex)}`,
      status: 'active',
      notes: 'Demodata',
    })),
  )
  if (resourceRows.length) await supabaseAdmin.from('resource_assets').insert(resourceRows)

  // 7. Tasks spread over the date range.
  const { data: taskTypes } = await supabaseAdmin.from('task_types').select('id, name').eq('company_id', companyId).eq('is_active', true).limit(10)
  const now = new Date()
  const taskRows = Array.from({ length: taskCount }, (_, index) => {
    const dayOffset = index % days
    const date = new Date(now)
    date.setDate(date.getDate() + dayOffset - Math.floor(days / 3))
    const hour = 7 + (index % 9)
    const start = new Date(date)
    start.setHours(hour, 0, 0, 0)
    const durationMinutes = [30, 45, 60, 90][index % 4]
    const end = new Date(start.getTime() + durationMinutes * 60000)
    const taskType = taskTypes?.[index % Math.max(taskTypes.length, 1)]
    return {
      company_id: companyId,
      task_type_id: taskType?.id ?? null,
      entity_id: entityIds[index % Math.max(entityIds.length, 1)] ?? null,
      title: `${taskType?.name ?? 'Uppdrag'} ${index + 1}`,
      status: 'scheduled',
      priority: index % 11 === 0 ? 'high' : 'normal',
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      time_window_start: start.toISOString(),
      time_window_end: new Date(end.getTime() + 60 * 60000).toISOString(),
      estimated_duration_minutes: durationMinutes,
      custom_fields: { demo: true },
      created_by: auth.userId,
    }
  })
  const { data: tasks } = await supabaseAdmin.from('tasks').insert(taskRows).select('id, scheduled_start, scheduled_end')

  // 8. Assignments for ~60% of tasks.
  if (staffIds.length && tasks?.length) {
    const assignmentRows = tasks
      .filter((_, index) => index % 5 !== 0 && index % 5 !== 4)
      .map((task, index) => ({
        company_id: companyId,
        task_id: task.id,
        staff_profile_id: staffIds[index % staffIds.length],
        planned_start_at: task.scheduled_start,
        planned_end_at: task.scheduled_end,
        status: 'assigned',
        source_type: 'manual',
        explanation: 'Demodata',
        metadata: { demo: true },
        created_by: auth.userId,
      }))
    if (assignmentRows.length) await supabaseAdmin.from('task_assignments').insert(assignmentRows)
  }

  // 9. A few example deviations.
  const deviationTitles = ['Kunde inte komma in — nyckel saknades', 'Kund var inte hemma', 'Fordon fick punktering', 'Extra tid krävdes på plats']
  const deviationRows = deviationTitles.slice(0, Math.min(4, Math.max(2, Math.round(taskCount / 20)))).map((title, index) => ({
    company_id: companyId,
    title,
    description: 'Demodata — exempel på avvikelse.',
    status: index === 0 ? 'open' : 'resolved',
    priority: index === 0 ? 'high' : 'normal',
    staff_profile_id: staffIds[index % Math.max(staffIds.length, 1)] ?? null,
    created_by: auth.userId,
  }))
  await supabaseAdmin.from('deviations').insert(deviationRows)

  await logAuditEvent({
    companyId,
    actorUserId: auth.userId,
    action: 'demo_company.created',
    entityType: 'company',
    entityId: companyId,
    metadata: { industry: profile.code, staffCount, taskCount, days, size },
  })
  await trackProductEvent('demo_company_created', { companyId, userId: auth.userId, metadata: { industry: profile.code } })

  revalidatePath('/admin/companies')
  redirect(`/admin/companies/${companyId}`)
}

export async function deleteDemoCompanyAction(formData: FormData) {
  const auth = await requirePlatformAdmin()
  const companyId = value(formData, 'company_id')
  if (!companyId) throw new Error('Bolag saknas.')

  // Strict guard: only companies explicitly marked as demo can be deleted.
  const { data: company, error } = await supabaseAdmin.from('companies').select('id, name, is_demo').eq('id', companyId).maybeSingle()
  if (error) throw toFriendlyError(error)
  if (!company) throw new Error('Bolaget kunde inte hittas.')
  if (!company.is_demo) throw new Error('Endast demobolag kan tas bort på detta sätt.')

  await logAuditEvent({
    companyId: null,
    actorUserId: auth.userId,
    action: 'demo_company.deleted',
    entityType: 'company',
    entityId: companyId,
    metadata: { name: company.name },
  })

  const { error: deleteError } = await supabaseAdmin.from('companies').delete().eq('id', companyId).eq('is_demo', true)
  if (deleteError) throw toFriendlyError(deleteError)

  revalidatePath('/admin/companies')
  redirect('/admin/companies')
}

export async function archiveDemoCompanyAction(formData: FormData) {
  const auth = await requirePlatformAdmin()
  const companyId = value(formData, 'company_id')
  if (!companyId) throw new Error('Bolag saknas.')

  const { data: company, error } = await supabaseAdmin.from('companies').select('id, is_demo').eq('id', companyId).maybeSingle()
  if (error) throw toFriendlyError(error)
  if (!company?.is_demo) throw new Error('Endast demobolag kan arkiveras på detta sätt.')

  const { error: updateError } = await supabaseAdmin
    .from('companies')
    .update({ lifecycle_status: 'archived', status: 'inactive', archived_at: new Date().toISOString(), archived_by: auth.userId })
    .eq('id', companyId)
    .eq('is_demo', true)
  if (updateError) throw toFriendlyError(updateError)

  await logAuditEvent({ companyId, actorUserId: auth.userId, action: 'demo_company.archived', entityType: 'company', entityId: companyId })
  revalidatePath('/admin/companies')
}
