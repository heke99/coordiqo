'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { assertCompanyPermission } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { queueAndSendEmail } from '@/lib/email/outbound'
import { conflictLevel } from '@/lib/planning/conflict-detection'
import { evaluateCandidate } from '@/lib/planning/candidate-scoring'
import { createPlanningRunWithDraft, recalculateShiftAssignmentCapacity } from '@/lib/planning/planning-engine'
import { publishPlanningDraft } from '@/lib/planning/publish-draft'
import { evaluateTaskAssignment } from '@/lib/planning/rule-engine'
import { supabaseAdmin } from '@/lib/supabase/admin'

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

class FormActionValidationError extends Error {
  fieldErrors: Record<string, string>

  constructor(message: string, fieldErrors: Record<string, string | undefined>) {
    super(message)
    this.name = 'FormActionValidationError'
    this.fieldErrors = Object.fromEntries(Object.entries(fieldErrors).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== ''))
  }
}

function formDataSnapshot(formData: FormData) {
  const snapshot: Record<string, string | string[]> = {}
  for (const [key, raw] of formData.entries()) {
    if (typeof raw !== 'string') continue
    const existing = snapshot[key]
    if (Array.isArray(existing)) existing.push(raw)
    else if (typeof existing === 'string') snapshot[key] = [existing, raw]
    else snapshot[key] = raw
  }
  return snapshot
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function isNextRedirectError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'digest' in error
    && typeof (error as { digest?: unknown }).digest === 'string'
    && (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
}

function normalizeCode(input: string | null) {
  return input
    ?.trim()
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) ?? null
}

function customFieldsFromForm(formData: FormData) {
  const customFields: Record<string, string> = {}

  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith('cf_')) continue
    if (typeof rawValue !== 'string') continue

    const fieldKey = key.slice(3)
    const trimmed = rawValue.trim()
    if (fieldKey && trimmed !== '') {
      customFields[fieldKey] = trimmed
    }
  }

  return customFields
}

function durationMinutesFromForm(formData: FormData) {
  const rawValue = Number(value(formData, 'duration_value') ?? value(formData, 'estimated_duration_minutes') ?? 60)
  const unit = value(formData, 'duration_unit') ?? 'minutes'
  const normalized = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 60
  return Math.max(1, Math.round(unit === 'hours' ? normalized * 60 : normalized))
}

function addMinutesIso(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString()
}


async function loadManualPlanningEvaluation(params: {
  companyId: string
  taskId: string
  staffProfileId?: string | null
  teamId?: string | null
  shiftId?: string | null
  plannedStartAt: string
  plannedEndAt: string
}) {
  const [{ data: task }, { data: staff }, { data: shift }, { data: requirements }, { data: staffSkills }, { data: staffCertifications }, { data: absences }, { data: existingAssignments }] = await Promise.all([
    supabaseAdmin
      .from('tasks')
      .select('id, company_id, task_type_id, entity_id, assigned_team_id, assigned_staff_id, title, priority, status, time_window_start, time_window_end, scheduled_start, scheduled_end, estimated_duration_minutes, sla_due_at')
      .eq('id', params.taskId)
      .eq('company_id', params.companyId)
      .is('archived_at', null)
      .maybeSingle(),
    params.staffProfileId
      ? supabaseAdmin
          .from('staff_profiles')
          .select('id, company_id, full_name, status, primary_team_id, transport_mode')
          .eq('id', params.staffProfileId)
          .eq('company_id', params.companyId)
          .is('archived_at', null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    params.shiftId
      ? supabaseAdmin
          .from('shifts')
          .select('id, company_id, staff_profile_id, team_id, title, shift_date, starts_at, ends_at, status, capacity_minutes, planned_minutes, remaining_minutes, planning_locked, transport_mode')
          .eq('id', params.shiftId)
          .eq('company_id', params.companyId)
          .is('archived_at', null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from('task_requirements')
      .select('id, task_id, requirement_kind, skill_id, certification_id, required_value, minimum_level, is_hard_requirement, description, skills(name), certifications(name)')
      .eq('company_id', params.companyId)
      .eq('task_id', params.taskId)
      .is('archived_at', null),
    params.staffProfileId
      ? supabaseAdmin
          .from('staff_skills')
          .select('id, staff_profile_id, skill_id, level')
          .eq('company_id', params.companyId)
          .eq('staff_profile_id', params.staffProfileId)
          .is('archived_at', null)
      : Promise.resolve({ data: [] }),
    params.staffProfileId
      ? supabaseAdmin
          .from('staff_certifications')
          .select('id, staff_profile_id, certification_id, status, expires_at')
          .eq('company_id', params.companyId)
          .eq('staff_profile_id', params.staffProfileId)
          .is('archived_at', null)
      : Promise.resolve({ data: [] }),
    params.staffProfileId
      ? supabaseAdmin
          .from('absences')
          .select('id, staff_profile_id, starts_at, ends_at, reason')
          .eq('company_id', params.companyId)
          .eq('staff_profile_id', params.staffProfileId)
          .eq('affects_planning', true)
          .is('archived_at', null)
          .lt('starts_at', params.plannedEndAt)
          .gt('ends_at', params.plannedStartAt)
      : Promise.resolve({ data: [] }),
    supabaseAdmin
      .from('task_assignments')
      .select('id, task_id, staff_profile_id, team_id, shift_id, planned_start_at, planned_end_at, status, is_locked')
      .eq('company_id', params.companyId)
      .is('archived_at', null)
      .in('status', ['draft', 'proposed', 'assigned', 'confirmed'])
      .lt('planned_start_at', params.plannedEndAt)
      .gt('planned_end_at', params.plannedStartAt)
      .limit(100),
  ])

  if (!task) throw new Error('Uppdraget kunde inte hittas.')
  if (params.staffProfileId && !staff) throw new Error('Personalen kunde inte hittas.')

  const evaluation = evaluateCandidate({
    task: task as any,
    staff: staff as any,
    teamId: params.teamId ?? (staff as any)?.primary_team_id ?? null,
    shift: shift as any,
    plannedStartAt: params.plannedStartAt,
    plannedEndAt: params.plannedEndAt,
    requirements: (requirements ?? []) as any,
    staffSkills: (staffSkills ?? []) as any,
    staffCertifications: (staffCertifications ?? []) as any,
    absences: (absences ?? []) as any,
    existingAssignments: (existingAssignments ?? []) as any,
    continuityMatch: false,
    areaMatch: Boolean((task as any).assigned_team_id && (staff as any)?.primary_team_id === (task as any).assigned_team_id),
  })

  return { task, staff, shift, evaluation }
}

async function requireMembership(minimumRole: Parameters<typeof assertCompanyPermission>[1], label: string) {
  const auth = await requireAuth()
  if (!auth.membership) redirect('/setup')
  assertCompanyPermission(auth.membership.companyRole, minimumRole, label)
  return auth
}

async function audit(companyId: string, actorUserId: string, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await supabaseAdmin.from('audit_logs').insert({
    company_id: companyId,
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  })
}

export async function createTeamAction(formData: FormData) {
  const auth = await requireMembership('supervisor', 'att skapa team')
  const name = value(formData, 'name')
  if (!name) throw new Error('Teamnamn krävs.')

  const { data, error } = await supabaseAdmin
    .from('teams')
    .insert({
      company_id: auth.membership!.companyId,
      name,
      code: value(formData, 'code'),
      description: value(formData, 'description'),
      area_label: value(formData, 'area_label'),
      team_lead_staff_profile_id: value(formData, 'team_lead_staff_profile_id'),
      status: value(formData, 'status') ?? 'active',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'team', data.id, { name })
  revalidatePath('/teams')
  redirect(`/teams/${data.id}`)
}

export async function updateTeamAction(formData: FormData) {
  const auth = await requireMembership('supervisor', 'att uppdatera team')
  const id = value(formData, 'id')
  if (!id) throw new Error('Team-id saknas.')

  const { error } = await supabaseAdmin
    .from('teams')
    .update({
      name: value(formData, 'name'),
      code: value(formData, 'code'),
      description: value(formData, 'description'),
      area_label: value(formData, 'area_label'),
      team_lead_staff_profile_id: value(formData, 'team_lead_staff_profile_id'),
      status: value(formData, 'status') ?? 'active',
    })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'update', 'team', id)
  revalidatePath('/teams')
  revalidatePath(`/teams/${id}`)
}

export async function archiveTeamAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att arkivera team')
  const id = value(formData, 'id')
  if (!id) throw new Error('Team-id saknas.')

  const { error } = await supabaseAdmin
    .from('teams')
    .update({ status: 'inactive', archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'team', id)
  revalidatePath('/teams')
  redirect('/teams')
}

export async function createStaffAction(formData: FormData) {
  const auth = await requireMembership('supervisor', 'att skapa personal')
  const fullName = value(formData, 'full_name')
  if (!fullName) throw new Error('Namn krävs.')

  const { data, error } = await supabaseAdmin
    .from('staff_profiles')
    .insert({
      company_id: auth.membership!.companyId,
      full_name: fullName,
      email: value(formData, 'email'),
      phone: value(formData, 'phone'),
      employee_id: value(formData, 'employee_id'),
      job_title: value(formData, 'job_title'),
      staff_kind: value(formData, 'staff_kind') ?? 'staff',
      employment_type: value(formData, 'employment_type') ?? 'unspecified',
      status: value(formData, 'status') ?? 'active',
      transport_mode: value(formData, 'transport_mode') ?? 'car',
      primary_team_id: value(formData, 'primary_team_id'),
      start_address: value(formData, 'start_address'),
      end_address: value(formData, 'end_address'),
      notes: value(formData, 'notes'),
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'staff_profile', data.id, { fullName })
  revalidatePath('/staff')
  redirect(`/staff/${data.id}`)
}

export async function updateStaffAction(formData: FormData) {
  const auth = await requireMembership('supervisor', 'att uppdatera personal')
  const id = value(formData, 'id')
  if (!id) throw new Error('Personal-id saknas.')

  const { error } = await supabaseAdmin
    .from('staff_profiles')
    .update({
      full_name: value(formData, 'full_name'),
      email: value(formData, 'email'),
      phone: value(formData, 'phone'),
      employee_id: value(formData, 'employee_id'),
      job_title: value(formData, 'job_title'),
      staff_kind: value(formData, 'staff_kind') ?? 'staff',
      employment_type: value(formData, 'employment_type') ?? 'unspecified',
      status: value(formData, 'status') ?? 'active',
      transport_mode: value(formData, 'transport_mode') ?? 'car',
      primary_team_id: value(formData, 'primary_team_id'),
      start_address: value(formData, 'start_address'),
      end_address: value(formData, 'end_address'),
      notes: value(formData, 'notes'),
      updated_by: auth.userId,
    })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'update', 'staff_profile', id)
  revalidatePath('/staff')
  revalidatePath(`/staff/${id}`)
}

export async function archiveStaffAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att arkivera personal')
  const id = value(formData, 'id')
  if (!id) throw new Error('Personal-id saknas.')

  const { error } = await supabaseAdmin
    .from('staff_profiles')
    .update({ status: 'archived', archived_at: new Date().toISOString(), updated_by: auth.userId })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'staff_profile', id)
  revalidatePath('/staff')
  redirect('/staff')
}

export async function createResourceAction(formData: FormData) {
  const auth = await requireMembership('supervisor', 'att skapa resurser')
  const name = value(formData, 'name')
  if (!name) throw new Error('Resursnamn krävs.')

  const { data, error } = await supabaseAdmin
    .from('resource_assets')
    .insert({
      company_id: auth.membership!.companyId,
      name,
      resource_type_id: value(formData, 'resource_type_id'),
      asset_tag: value(formData, 'asset_tag'),
      status: value(formData, 'status') ?? 'available',
      assigned_staff_id: value(formData, 'assigned_staff_id'),
      assigned_team_id: value(formData, 'assigned_team_id'),
      location_label: value(formData, 'location_label'),
      notes: value(formData, 'notes'),
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'resource_asset', data.id, { name })
  revalidatePath('/resources')
  redirect(`/resources/${data.id}`)
}

export async function updateResourceAction(formData: FormData) {
  const auth = await requireMembership('supervisor', 'att uppdatera resurser')
  const id = value(formData, 'id')
  if (!id) throw new Error('Resurs-id saknas.')

  const { error } = await supabaseAdmin
    .from('resource_assets')
    .update({
      name: value(formData, 'name'),
      resource_type_id: value(formData, 'resource_type_id'),
      asset_tag: value(formData, 'asset_tag'),
      status: value(formData, 'status') ?? 'available',
      assigned_staff_id: value(formData, 'assigned_staff_id'),
      assigned_team_id: value(formData, 'assigned_team_id'),
      location_label: value(formData, 'location_label'),
      notes: value(formData, 'notes'),
      updated_by: auth.userId,
    })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'update', 'resource_asset', id)
  revalidatePath('/resources')
  revalidatePath(`/resources/${id}`)
}

export async function archiveResourceAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att arkivera resurser')
  const id = value(formData, 'id')
  if (!id) throw new Error('Resurs-id saknas.')

  const { error } = await supabaseAdmin
    .from('resource_assets')
    .update({ status: 'archived', archived_at: new Date().toISOString(), updated_by: auth.userId })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'resource_asset', id)
  revalidatePath('/resources')
  redirect('/resources')
}

export async function createEntityAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa objekt')
  const name = value(formData, 'name')
  const entityTypeId = value(formData, 'entity_type_id')
  if (!name) throw new Error('Objektnamn krävs.')
  if (!entityTypeId) throw new Error('Objekttyp krävs.')

  const { data, error } = await supabaseAdmin
    .from('entities')
    .insert({
      company_id: auth.membership!.companyId,
      entity_type_id: entityTypeId,
      primary_team_id: value(formData, 'primary_team_id'),
      name,
      external_id: value(formData, 'external_id'),
      status: value(formData, 'status') ?? 'active',
      priority: value(formData, 'priority') ?? 'normal',
      summary: value(formData, 'summary'),
      instructions: value(formData, 'instructions'),
      custom_fields: customFieldsFromForm(formData),
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  const street = value(formData, 'street')
  const city = value(formData, 'city')
  if (street || city) {
    await supabaseAdmin.from('entity_addresses').insert({
      entity_id: data.id,
      street,
      postal_code: value(formData, 'postal_code'),
      city,
      access_instructions: value(formData, 'access_instructions'),
      is_primary: true,
    })
  }

  const contactName = value(formData, 'contact_name')
  if (contactName) {
    await supabaseAdmin.from('entity_contacts').insert({
      entity_id: data.id,
      name: contactName,
      role_label: value(formData, 'contact_role'),
      email: value(formData, 'contact_email'),
      phone: value(formData, 'contact_phone'),
      is_primary: true,
    })
  }

  await audit(auth.membership!.companyId, auth.userId, 'create', 'entity', data.id, { name })
  revalidatePath('/entities')
  redirect(`/entities/${data.id}`)
}

export async function updateEntityAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att uppdatera objekt')
  const id = value(formData, 'id')
  if (!id) throw new Error('Objekt-id saknas.')

  const { error } = await supabaseAdmin
    .from('entities')
    .update({
      entity_type_id: value(formData, 'entity_type_id'),
      primary_team_id: value(formData, 'primary_team_id'),
      name: value(formData, 'name'),
      external_id: value(formData, 'external_id'),
      status: value(formData, 'status') ?? 'active',
      priority: value(formData, 'priority') ?? 'normal',
      summary: value(formData, 'summary'),
      instructions: value(formData, 'instructions'),
      custom_fields: customFieldsFromForm(formData),
      updated_by: auth.userId,
    })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'update', 'entity', id)
  revalidatePath('/entities')
  revalidatePath(`/entities/${id}`)
}

export async function archiveEntityAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att arkivera objekt')
  const id = value(formData, 'id')
  if (!id) throw new Error('Objekt-id saknas.')

  const { error } = await supabaseAdmin
    .from('entities')
    .update({ status: 'archived', archived_at: new Date().toISOString(), updated_by: auth.userId })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'entity', id)
  revalidatePath('/entities')
  redirect('/entities')
}

export async function createInvitationAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att skapa inbjudningar')
  const email = value(formData, 'email')?.toLowerCase()
  const fullName = value(formData, 'full_name')
  const role = value(formData, 'role') ?? 'staff'
  const message = value(formData, 'message')

  if (!email) throw new Error('E-post krävs.')

  const { data, error } = await supabaseAdmin
    .from('company_invitations')
    .insert({
      company_id: auth.membership!.companyId,
      email,
      full_name: fullName,
      role,
      message,
      status: 'pending',
      invited_by: auth.userId,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    })
    .select('id, token')
    .single()

  if (error) throw new Error(error.message)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const acceptUrl = `${siteUrl}/invite/accept?token=${data.token}`
  const delivery = await queueAndSendEmail({
    companyId: auth.membership!.companyId,
    to: email,
    subject: `Inbjudan till ${auth.membership!.companyName} i Coordiqo`,
    bodyText: [
      `Hej${fullName ? ` ${fullName}` : ''},`,
      '',
      `${auth.profileName ?? 'En administratör'} har bjudit in dig till ${auth.membership!.companyName} i Coordiqo.`,
      `Roll: ${role}`,
      message ? `Meddelande: ${message}` : null,
      '',
      `Acceptera inbjudan här: ${acceptUrl}`,
      '',
      'Länken är tidsbegränsad och ska inte delas vidare.',
    ].filter(Boolean).join('\n'),
    relatedEntityType: 'company_invitation',
    relatedEntityId: data.id,
    createdBy: auth.userId,
  })

  await supabaseAdmin
    .from('company_invitations')
    .update({
      email_delivery_status: delivery.status === 'sent' ? 'sent' : delivery.status === 'failed' ? 'failed' : 'queued',
      email_sent_at: delivery.status === 'sent' ? new Date().toISOString() : null,
      last_email_error: delivery.status === 'failed' ? delivery.error ?? 'E-postutskick misslyckades' : null,
    })
    .eq('id', data.id)

  await audit(auth.membership!.companyId, auth.userId, 'create', 'company_invitation', data.id, { email, role, emailDelivery: delivery.status })
  revalidatePath('/settings/invitations')
}

export async function cancelInvitationAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att avbryta inbjudningar')
  const id = value(formData, 'id')
  if (!id) throw new Error('Invite-id saknas.')

  const { error } = await supabaseAdmin
    .from('company_invitations')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'cancel', 'company_invitation', id)
  revalidatePath('/settings/invitations')
}

export async function createEntityTypeAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att skapa objekttyper')
  const labelSingular = value(formData, 'label_singular')
  const labelPlural = value(formData, 'label_plural')
  const code = value(formData, 'code')?.toLowerCase().replace(/[^a-z0-9_\-]/g, '_')

  if (!labelSingular) throw new Error('Singular etikett krävs.')
  if (!labelPlural) throw new Error('Plural etikett krävs.')
  if (!code) throw new Error('Kod krävs.')

  const { data, error } = await supabaseAdmin
    .from('entity_types')
    .insert({
      company_id: auth.membership!.companyId,
      code,
      label_singular: labelSingular,
      label_plural: labelPlural,
      description: value(formData, 'description'),
      source: 'company_custom',
      is_active: true,
      sort_order: Number(value(formData, 'sort_order') ?? 100),
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'entity_type', data.id, { code, labelSingular })
  revalidatePath('/settings/entity-types')
  redirect(`/settings/entity-types/${data.id}`)
}

export async function updateEntityTypeAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att uppdatera objekttyper')
  const id = value(formData, 'id')
  if (!id) throw new Error('Objekttyp-id saknas.')

  const { error } = await supabaseAdmin
    .from('entity_types')
    .update({
      label_singular: value(formData, 'label_singular'),
      label_plural: value(formData, 'label_plural'),
      description: value(formData, 'description'),
      is_active: value(formData, 'is_active') !== 'false',
      sort_order: Number(value(formData, 'sort_order') ?? 100),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'update', 'entity_type', id)
  revalidatePath('/settings/entity-types')
  revalidatePath(`/settings/entity-types/${id}`)
}

export async function archiveEntityTypeAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att arkivera objekttyper')
  const id = value(formData, 'id')
  if (!id) throw new Error('Objekttyp-id saknas.')

  const { count } = await supabaseAdmin
    .from('entities')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', auth.membership!.companyId)
    .eq('entity_type_id', id)
    .is('archived_at', null)

  if ((count ?? 0) > 0) {
    throw new Error('Objekttypen används av aktiva objekt och kan inte arkiveras ännu.')
  }

  const { error } = await supabaseAdmin
    .from('entity_types')
    .update({ is_active: false, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'entity_type', id)
  revalidatePath('/settings/entity-types')
  redirect('/settings/entity-types')
}

export async function createEntityTypeFieldAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att skapa dynamiska fält')
  const entityTypeId = value(formData, 'entity_type_id')
  const fieldKey = value(formData, 'field_key')?.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  const label = value(formData, 'label')
  if (!entityTypeId) throw new Error('Objekttyp saknas.')
  if (!fieldKey) throw new Error('Fältnyckel krävs.')
  if (!label) throw new Error('Fältetikett krävs.')

  const { data: type } = await supabaseAdmin
    .from('entity_types')
    .select('id')
    .eq('id', entityTypeId)
    .eq('company_id', auth.membership!.companyId)
    .maybeSingle()

  if (!type) throw new Error('Objekttypen kunde inte hittas.')

  const { data, error } = await supabaseAdmin
    .from('entity_type_fields')
    .insert({
      entity_type_id: entityTypeId,
      field_key: fieldKey,
      label,
      field_type: value(formData, 'field_type') ?? 'text',
      is_required: value(formData, 'is_required') === 'true',
      is_sensitive: value(formData, 'is_sensitive') === 'true',
      sort_order: Number(value(formData, 'sort_order') ?? 100),
      config: {
        placeholder: value(formData, 'placeholder'),
        help_text: value(formData, 'help_text'),
      },
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'entity_type_field', data.id, { entityTypeId, fieldKey })
  revalidatePath(`/settings/entity-types/${entityTypeId}`)
}

export async function archiveEntityTypeFieldAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att arkivera dynamiska fält')
  const id = value(formData, 'id')
  const entityTypeId = value(formData, 'entity_type_id')
  if (!id || !entityTypeId) throw new Error('Fält-id saknas.')

  const { error } = await supabaseAdmin
    .from('entity_type_fields')
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'entity_type_field', id, { entityTypeId })
  revalidatePath(`/settings/entity-types/${entityTypeId}`)
}

export async function createEntityNoteAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa objektnoteringar')
  const entityId = value(formData, 'entity_id')
  const note = value(formData, 'note')
  if (!entityId) throw new Error('Objekt-id saknas.')
  if (!note) throw new Error('Notering krävs.')

  const { data: entity } = await supabaseAdmin
    .from('entities')
    .select('id')
    .eq('id', entityId)
    .eq('company_id', auth.membership!.companyId)
    .maybeSingle()

  if (!entity) throw new Error('Objektet kunde inte hittas.')

  const { data, error } = await supabaseAdmin
    .from('entity_notes')
    .insert({
      entity_id: entityId,
      company_id: auth.membership!.companyId,
      note,
      visibility: value(formData, 'visibility') ?? 'internal',
      author_user_id: auth.userId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'entity_note', data.id, { entityId })
  revalidatePath(`/entities/${entityId}`)
}

export async function createEntityDocumentAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att lägga till dokumentmetadata')
  const entityId = value(formData, 'entity_id')
  const fileName = value(formData, 'file_name')
  const storagePath = value(formData, 'storage_path')
  if (!entityId) throw new Error('Objekt-id saknas.')
  if (!fileName) throw new Error('Filnamn krävs.')
  if (!storagePath) throw new Error('Storage path eller extern filreferens krävs.')

  const { data: entity } = await supabaseAdmin
    .from('entities')
    .select('id')
    .eq('id', entityId)
    .eq('company_id', auth.membership!.companyId)
    .maybeSingle()

  if (!entity) throw new Error('Objektet kunde inte hittas.')

  const { data, error } = await supabaseAdmin
    .from('entity_documents')
    .insert({
      entity_id: entityId,
      company_id: auth.membership!.companyId,
      file_name: fileName,
      storage_path: storagePath,
      document_type: value(formData, 'document_type'),
      mime_type: value(formData, 'mime_type'),
      uploaded_by: auth.userId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'entity_document', data.id, { entityId, fileName })
  revalidatePath(`/entities/${entityId}`)
}

export async function createEntityRelationAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa objektrelationer')
  const parentEntityId = value(formData, 'parent_entity_id')
  const childEntityId = value(formData, 'child_entity_id')
  if (!parentEntityId || !childEntityId) throw new Error('Både huvudobjekt och kopplat objekt krävs.')
  if (parentEntityId === childEntityId) throw new Error('Ett objekt kan inte relateras till sig självt.')

  const { data: child } = await supabaseAdmin
    .from('entities')
    .select('id')
    .eq('id', childEntityId)
    .eq('company_id', auth.membership!.companyId)
    .maybeSingle()

  if (!child) throw new Error('Det kopplade objektet kunde inte hittas.')

  const { data, error } = await supabaseAdmin
    .from('entity_relations')
    .insert({
      company_id: auth.membership!.companyId,
      parent_entity_id: parentEntityId,
      child_entity_id: childEntityId,
      relation_type: value(formData, 'relation_type') ?? 'related',
      notes: value(formData, 'notes'),
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'entity_relation', data.id, { parentEntityId, childEntityId })
  revalidatePath(`/entities/${parentEntityId}`)
}

export async function acceptInvitationAction(formData: FormData) {
  const auth = await requireAuth()
  const token = value(formData, 'token')
  if (!token) throw new Error('Invite-token saknas.')

  const { data: invitation, error: inviteError } = await supabaseAdmin
    .from('company_invitations')
    .select('id, company_id, email, full_name, role, status, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (inviteError) throw new Error(inviteError.message)
  if (!invitation) throw new Error('Inbjudan kunde inte hittas.')
  if (invitation.status !== 'pending') throw new Error('Inbjudan är inte längre aktiv.')
  if (new Date(invitation.expires_at).getTime() < Date.now()) throw new Error('Inbjudan har gått ut.')
  if (auth.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new Error(`Du är inloggad som ${auth.email ?? 'okänd användare'}, men inbjudan gäller ${invitation.email}.`)
  }

  const { data: existing } = await supabaseAdmin
    .from('company_memberships')
    .select('id')
    .eq('company_id', invitation.company_id)
    .eq('user_id', auth.userId)
    .maybeSingle()

  let membershipId = existing?.id ?? null

  if (membershipId) {
    const { error } = await supabaseAdmin
      .from('company_memberships')
      .update({ role: invitation.role, status: 'active', is_default: true })
      .eq('id', membershipId)
    if (error) throw new Error(error.message)
  } else {
    const { data: membership, error } = await supabaseAdmin
      .from('company_memberships')
      .insert({
        company_id: invitation.company_id,
        user_id: auth.userId,
        role: invitation.role,
        status: 'active',
        is_default: true,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    membershipId = membership.id
  }

  await supabaseAdmin
    .from('company_memberships')
    .update({ is_default: false })
    .eq('user_id', auth.userId)
    .neq('id', membershipId)

  await supabaseAdmin
    .from('profiles')
    .upsert({ id: auth.userId, email: auth.email, full_name: invitation.full_name ?? auth.profileName }, { onConflict: 'id' })

  const { error: updateInviteError } = await supabaseAdmin
    .from('company_invitations')
    .update({ status: 'accepted', accepted_by: auth.userId, accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  if (updateInviteError) throw new Error(updateInviteError.message)
  await audit(invitation.company_id, auth.userId, 'accept', 'company_invitation', invitation.id, { role: invitation.role })
  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function createTaskAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa uppdrag')
  const title = value(formData, 'title')
  if (!title) throw new Error('Titel krävs.')

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert({
      company_id: auth.membership!.companyId,
      task_type_id: value(formData, 'task_type_id'),
      work_order_id: value(formData, 'work_order_id'),
      service_request_id: value(formData, 'service_request_id'),
      entity_id: value(formData, 'entity_id'),
      assigned_team_id: value(formData, 'assigned_team_id'),
      assigned_staff_id: value(formData, 'assigned_staff_id'),
      title,
      description: value(formData, 'description'),
      instructions: value(formData, 'instructions'),
      priority: value(formData, 'priority') ?? 'normal',
      status: value(formData, 'status') ?? 'unscheduled',
      time_window_start: value(formData, 'time_window_start'),
      time_window_end: value(formData, 'time_window_end'),
      scheduled_start: value(formData, 'scheduled_start'),
      scheduled_end: value(formData, 'scheduled_end'),
      estimated_duration_minutes: durationMinutesFromForm(formData),
      sla_due_at: value(formData, 'sla_due_at'),
      recurrence_rule: value(formData, 'recurrence_rule'),
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await supabaseAdmin.from('task_status_history').insert({ company_id: auth.membership!.companyId, task_id: data.id, new_status: value(formData, 'status') ?? 'unscheduled', changed_by: auth.userId })
  await audit(auth.membership!.companyId, auth.userId, 'create', 'task', data.id, { title })
  revalidatePath('/tasks')
  redirect(`/tasks/${data.id}`)
}

export async function updateTaskAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att uppdatera uppdrag')
  const id = value(formData, 'id')
  if (!id) throw new Error('Uppdrags-id saknas.')

  const { data: current } = await supabaseAdmin
    .from('tasks')
    .select('status')
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)
    .maybeSingle()

  const newStatus = value(formData, 'status') ?? 'unscheduled'
  const { error } = await supabaseAdmin
    .from('tasks')
    .update({
      task_type_id: value(formData, 'task_type_id'),
      work_order_id: value(formData, 'work_order_id'),
      service_request_id: value(formData, 'service_request_id'),
      entity_id: value(formData, 'entity_id'),
      assigned_team_id: value(formData, 'assigned_team_id'),
      assigned_staff_id: value(formData, 'assigned_staff_id'),
      title: value(formData, 'title'),
      description: value(formData, 'description'),
      instructions: value(formData, 'instructions'),
      priority: value(formData, 'priority') ?? 'normal',
      status: newStatus,
      time_window_start: value(formData, 'time_window_start'),
      time_window_end: value(formData, 'time_window_end'),
      scheduled_start: value(formData, 'scheduled_start'),
      scheduled_end: value(formData, 'scheduled_end'),
      estimated_duration_minutes: durationMinutesFromForm(formData),
      sla_due_at: value(formData, 'sla_due_at'),
      recurrence_rule: value(formData, 'recurrence_rule'),
      updated_by: auth.userId,
    })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  if (current?.status !== newStatus) {
    await supabaseAdmin.from('task_status_history').insert({ company_id: auth.membership!.companyId, task_id: id, old_status: current?.status, new_status: newStatus, changed_by: auth.userId })
  }
  await audit(auth.membership!.companyId, auth.userId, 'update', 'task', id)
  revalidatePath('/tasks')
  revalidatePath(`/tasks/${id}`)
}

export async function archiveTaskAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att arkivera uppdrag')
  const id = value(formData, 'id')
  if (!id) throw new Error('Uppdrags-id saknas.')

  const { error } = await supabaseAdmin
    .from('tasks')
    .update({ status: 'archived', archived_at: new Date().toISOString(), updated_by: auth.userId })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'task', id)
  revalidatePath('/tasks')
  redirect('/tasks')
}

export async function createTaskCommentAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att kommentera uppdrag')
  const taskId = value(formData, 'task_id')
  const comment = value(formData, 'comment')
  if (!taskId || !comment) throw new Error('Uppdrag och kommentar krävs.')

  const { data: task } = await supabaseAdmin.from('tasks').select('id').eq('id', taskId).eq('company_id', auth.membership!.companyId).maybeSingle()
  if (!task) throw new Error('Uppdraget kunde inte hittas.')

  const { data, error } = await supabaseAdmin
    .from('task_comments')
    .insert({ company_id: auth.membership!.companyId, task_id: taskId, comment, visibility: value(formData, 'visibility') ?? 'internal', author_user_id: auth.userId })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'task_comment', data.id, { taskId })
  revalidatePath(`/tasks/${taskId}`)
}

export async function createWorkOrderAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa arbetsorder')
  const title = value(formData, 'title')
  if (!title) throw new Error('Titel krävs.')

  const { data, error } = await supabaseAdmin
    .from('work_orders')
    .insert({
      company_id: auth.membership!.companyId,
      service_request_id: value(formData, 'service_request_id'),
      entity_id: value(formData, 'entity_id'),
      title,
      description: value(formData, 'description'),
      priority: value(formData, 'priority') ?? 'normal',
      status: value(formData, 'status') ?? 'open',
      due_at: value(formData, 'due_at'),
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'work_order', data.id, { title })
  revalidatePath('/work-orders')
  redirect('/work-orders')
}

export async function updatePermissionOverrideAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att uppdatera behörigheter')
  const role = value(formData, 'role')
  const permissionKey = value(formData, 'permission_key')
  const isAllowed = value(formData, 'is_allowed') === 'true'
  if (!role || !permissionKey) throw new Error('Roll och permission krävs.')

  const { data, error } = await supabaseAdmin
    .from('company_role_permissions')
    .upsert({
      company_id: auth.membership!.companyId,
      role,
      permission_key: permissionKey,
      is_allowed: isAllowed,
      source: 'company_override',
      updated_by: auth.userId,
    }, { onConflict: 'company_id,role,permission_key' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'override', 'company_role_permission', data.id, { role, permissionKey, isAllowed })
  revalidatePath('/settings/permissions')
}

export async function createSupportSessionAction(formData: FormData) {
  const auth = await requireMembership('company_admin', 'att starta supportläge')
  const reason = value(formData, 'reason')
  if (!reason) throw new Error('Anledning krävs.')

  const { data, error } = await supabaseAdmin
    .from('support_sessions')
    .insert({ company_id: auth.membership!.companyId, support_user_id: auth.userId, target_membership_id: value(formData, 'target_membership_id'), reason })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'start', 'support_session', data.id, { reason })
  revalidatePath('/settings/support')
}

export async function endSupportSessionAction(formData: FormData) {
  const auth = await requireMembership('company_admin', 'att avsluta supportläge')
  const id = value(formData, 'id')
  if (!id) throw new Error('Supportsession saknas.')

  const { error } = await supabaseAdmin
    .from('support_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'end', 'support_session', id)
  revalidatePath('/settings/support')
}

export async function updateEntityNoteAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att uppdatera objektnoteringar')
  const id = value(formData, 'id')
  const entityId = value(formData, 'entity_id')
  const note = value(formData, 'note')
  if (!id || !entityId || !note) throw new Error('Notering saknar obligatoriska fält.')

  const { error } = await supabaseAdmin
    .from('entity_notes')
    .update({ note, visibility: value(formData, 'visibility') ?? 'internal', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'update', 'entity_note', id, { entityId })
  revalidatePath(`/entities/${entityId}`)
}

export async function archiveEntityNoteAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att arkivera objektnoteringar')
  const id = value(formData, 'id')
  const entityId = value(formData, 'entity_id')
  if (!id || !entityId) throw new Error('Notering saknar id.')

  const { error } = await supabaseAdmin
    .from('entity_notes')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'entity_note', id, { entityId })
  revalidatePath(`/entities/${entityId}`)
}

export async function archiveEntityRelationAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att arkivera objektrelationer')
  const id = value(formData, 'id')
  const entityId = value(formData, 'entity_id')
  if (!id || !entityId) throw new Error('Relation saknar id.')

  const { error } = await supabaseAdmin
    .from('entity_relations')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'entity_relation', id, { entityId })
  revalidatePath(`/entities/${entityId}`)
}

export async function uploadEntityDocumentAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att ladda upp dokument')
  const entityId = value(formData, 'entity_id')
  const file = formData.get('file')
  if (!entityId) throw new Error('Objekt-id saknas.')
  if (!(file instanceof File) || file.size === 0) throw new Error('Fil krävs.')

  const { data: entity } = await supabaseAdmin.from('entities').select('id').eq('id', entityId).eq('company_id', auth.membership!.companyId).maybeSingle()
  if (!entity) throw new Error('Objektet kunde inte hittas.')

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${auth.membership!.companyId}/entities/${entityId}/${Date.now()}-${safeName}`
  const { error: uploadError } = await supabaseAdmin.storage.from('coordiqo-documents').upload(storagePath, file, { upsert: false, contentType: file.type || undefined })
  if (uploadError) throw new Error(uploadError.message)

  const { data, error } = await supabaseAdmin
    .from('entity_documents')
    .insert({
      entity_id: entityId,
      company_id: auth.membership!.companyId,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      document_type: value(formData, 'document_type'),
      description: value(formData, 'description'),
      uploaded_by: auth.userId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'upload', 'entity_document', data.id, { entityId, fileName: file.name })
  revalidatePath(`/entities/${entityId}`)
}

export async function archiveEntityDocumentAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att arkivera dokument')
  const id = value(formData, 'id')
  const entityId = value(formData, 'entity_id')
  if (!id || !entityId) throw new Error('Dokument saknar id.')

  const { error } = await supabaseAdmin
    .from('entity_documents')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'entity_document', id, { entityId })
  revalidatePath(`/entities/${entityId}`)
}


export async function createSkillAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att skapa eller uppdatera kompetenser')
  const name = value(formData, 'name')
  const code = normalizeCode(value(formData, 'code') ?? name)
  if (!name) throw new Error('Kompetensnamn krävs.')
  if (!code) throw new Error('Kompetenskod krävs.')

  const payload = {
    company_id: auth.membership!.companyId,
    code,
    name,
    category: value(formData, 'category') ?? 'general',
    description: value(formData, 'description'),
    is_active: value(formData, 'is_active') !== 'false',
    archived_at: null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from('skills')
    .upsert(payload, { onConflict: 'company_id,code' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'upsert', 'skill', data.id, { code, name })
  revalidatePath('/settings/skills')
}

export async function archiveSkillAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att arkivera kompetenser')
  const id = value(formData, 'id')
  if (!id) throw new Error('Kompetens-id saknas.')
  const { error } = await supabaseAdmin.from('skills').update({ is_active: false, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'skill', id)
  revalidatePath('/settings/skills')
}

export async function createCertificationAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att skapa eller uppdatera certifikat')
  const name = value(formData, 'name')
  const code = normalizeCode(value(formData, 'code') ?? name)
  if (!name) throw new Error('Certifikatnamn krävs.')
  if (!code) throw new Error('Certifikatkod krävs.')

  const payload = {
    company_id: auth.membership!.companyId,
    code,
    name,
    category: value(formData, 'category') ?? 'general',
    description: value(formData, 'description'),
    requires_expiry: value(formData, 'requires_expiry') !== 'false',
    is_active: value(formData, 'is_active') !== 'false',
    archived_at: null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from('certifications')
    .upsert(payload, { onConflict: 'company_id,code' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'upsert', 'certification', data.id, { code, name })
  revalidatePath('/settings/skills')
}

export async function archiveCertificationAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att arkivera certifikat')
  const id = value(formData, 'id')
  if (!id) throw new Error('Certifikat-id saknas.')
  const { error } = await supabaseAdmin.from('certifications').update({ is_active: false, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'certification', id)
  revalidatePath('/settings/skills')
}

export async function assignStaffSkillAction(formData: FormData) {
  const auth = await requireMembership('supervisor', 'att tilldela kompetenser')
  const staffProfileId = value(formData, 'staff_profile_id')
  const skillId = value(formData, 'skill_id')
  if (!staffProfileId || !skillId) throw new Error('Personal och kompetens krävs.')

  const { data, error } = await supabaseAdmin
    .from('staff_skills')
    .upsert({
      company_id: auth.membership!.companyId,
      staff_profile_id: staffProfileId,
      skill_id: skillId,
      level: value(formData, 'level') ?? 'qualified',
      notes: value(formData, 'notes'),
      verified_by: auth.userId,
      verified_at: new Date().toISOString(),
      archived_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'staff_profile_id,skill_id' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'assign', 'staff_skill', data.id, { staffProfileId, skillId })
  revalidatePath(`/staff/${staffProfileId}`)
}

export async function removeStaffSkillAction(formData: FormData) {
  const auth = await requireMembership('supervisor', 'att ta bort kompetenser')
  const id = value(formData, 'id')
  const staffProfileId = value(formData, 'staff_profile_id')
  if (!id || !staffProfileId) throw new Error('Kompetensrad saknas.')
  const { error } = await supabaseAdmin.from('staff_skills').update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'staff_skill', id, { staffProfileId })
  revalidatePath(`/staff/${staffProfileId}`)
}

export async function assignStaffCertificationAction(formData: FormData) {
  const auth = await requireMembership('supervisor', 'att tilldela certifikat')
  const staffProfileId = value(formData, 'staff_profile_id')
  const certificationId = value(formData, 'certification_id')
  if (!staffProfileId || !certificationId) throw new Error('Personal och certifikat krävs.')

  const { data, error } = await supabaseAdmin
    .from('staff_certifications')
    .upsert({
      company_id: auth.membership!.companyId,
      staff_profile_id: staffProfileId,
      certification_id: certificationId,
      certificate_number: value(formData, 'certificate_number'),
      status: value(formData, 'status') ?? 'valid',
      issued_at: value(formData, 'issued_at'),
      expires_at: value(formData, 'expires_at'),
      notes: value(formData, 'notes'),
      verified_by: auth.userId,
      verified_at: new Date().toISOString(),
      archived_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'staff_profile_id,certification_id' })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'assign', 'staff_certification', data.id, { staffProfileId, certificationId })
  revalidatePath(`/staff/${staffProfileId}`)
}

export async function removeStaffCertificationAction(formData: FormData) {
  const auth = await requireMembership('supervisor', 'att ta bort certifikat')
  const id = value(formData, 'id')
  const staffProfileId = value(formData, 'staff_profile_id')
  if (!id || !staffProfileId) throw new Error('Certifikatrad saknas.')
  const { error } = await supabaseAdmin.from('staff_certifications').update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'staff_certification', id, { staffProfileId })
  revalidatePath(`/staff/${staffProfileId}`)
}

export async function createTaskRequirementAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa uppdragskrav')
  const taskId = value(formData, 'task_id')
  const kind = value(formData, 'requirement_kind') ?? 'skill'
  if (!taskId) throw new Error('Uppdrag saknas.')

  const { data: task } = await supabaseAdmin.from('tasks').select('id').eq('id', taskId).eq('company_id', auth.membership!.companyId).maybeSingle()
  if (!task) throw new Error('Uppdraget kunde inte hittas.')

  const { data, error } = await supabaseAdmin
    .from('task_requirements')
    .insert({
      company_id: auth.membership!.companyId,
      task_id: taskId,
      requirement_kind: kind,
      skill_id: kind === 'skill' ? value(formData, 'skill_id') : null,
      certification_id: kind === 'certification' ? value(formData, 'certification_id') : null,
      required_value: value(formData, 'required_value'),
      minimum_level: value(formData, 'minimum_level'),
      is_hard_requirement: value(formData, 'is_hard_requirement') !== 'false',
      description: value(formData, 'description'),
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'task_requirement', data.id, { taskId, kind })
  revalidatePath(`/tasks/${taskId}`)
}

export async function archiveTaskRequirementAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att arkivera uppdragskrav')
  const id = value(formData, 'id')
  const taskId = value(formData, 'task_id')
  if (!id || !taskId) throw new Error('Krav-id saknas.')
  const { error } = await supabaseAdmin.from('task_requirements').update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'task_requirement', id, { taskId })
  revalidatePath(`/tasks/${taskId}`)
}

export async function runTaskRuleCheckAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att köra regelkontroll')
  const taskId = value(formData, 'task_id')
  const staffProfileId = value(formData, 'staff_profile_id')
  if (!taskId || !staffProfileId) throw new Error('Uppdrag och personal krävs för regelkontroll.')
  const result = await evaluateTaskAssignment({ companyId: auth.membership!.companyId, taskId, staffProfileId, actorUserId: auth.userId })
  await audit(auth.membership!.companyId, auth.userId, 'evaluate', 'task_assignment_rules', taskId, { staffProfileId, hardBlockers: result.hardBlockers, softWarnings: result.softWarnings })
  revalidatePath(`/tasks/${taskId}`)
}

export async function resolveRuleViolationAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att lösa regelbrott')
  const id = value(formData, 'id')
  const taskId = value(formData, 'task_id')
  if (!id || !taskId) throw new Error('Regelbrott saknar id.')
  const { error } = await supabaseAdmin.from('rule_violations').update({ status: 'resolved', resolved_by: auth.userId, resolved_at: new Date().toISOString() }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'resolve', 'rule_violation', id, { taskId })
  revalidatePath(`/tasks/${taskId}`)
}



export async function createManualTaskAssignmentAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att tilldela uppdrag')
  const taskId = value(formData, 'task_id')
  const staffProfileId = value(formData, 'staff_profile_id')
  const teamId = value(formData, 'team_id')
  const shiftId = value(formData, 'shift_id')
  const plannedStartAt = value(formData, 'planned_start_at')
  let plannedEndAt = value(formData, 'planned_end_at')

  if (!taskId) throw new Error('Uppdrag saknas.')
  if (!staffProfileId && !teamId) throw new Error('Välj personal eller team.')
  if (!plannedStartAt) throw new Error('Planerad start krävs.')

  const { data: durationTask } = await supabaseAdmin
    .from('tasks')
    .select('estimated_duration_minutes')
    .eq('id', taskId)
    .eq('company_id', auth.membership!.companyId)
    .maybeSingle()

  plannedEndAt = plannedEndAt ?? addMinutesIso(plannedStartAt, Number(durationTask?.estimated_duration_minutes ?? 60))
  if (new Date(plannedEndAt) <= new Date(plannedStartAt)) throw new Error('Planerad sluttid måste vara efter starttid.')

  const { task, staff, shift, evaluation } = await loadManualPlanningEvaluation({
    companyId: auth.membership!.companyId,
    taskId,
    staffProfileId,
    teamId,
    shiftId,
    plannedStartAt,
    plannedEndAt,
  })

  const hardConflicts = evaluation.conflicts.filter((conflict) => ['hard', 'critical', 'blocked'].includes(conflict.severity))
  const softConflicts = evaluation.conflicts.filter((conflict) => ['soft', 'warning'].includes(conflict.severity))
  const overrideSoft = value(formData, 'override_soft_conflicts') === 'true'
  const overrideReason = value(formData, 'override_reason')

  if (hardConflicts.length > 0) {
    throw new Error(`Tilldelningen stoppades av hårda konflikter: ${hardConflicts.slice(0, 3).map((conflict) => conflict.message).join(' ')}`)
  }

  if (softConflicts.length > 0 && !overrideSoft) {
    throw new Error(`Mjuka konflikter behöver granskas eller override: ${softConflicts.slice(0, 3).map((conflict) => conflict.message).join(' ')}`)
  }

  if (softConflicts.length > 0 && overrideSoft && !overrideReason) {
    throw new Error('Override reason krävs när mjuka konflikter ignoreras.')
  }

  const { data: assignment, error } = await supabaseAdmin
    .from('task_assignments')
    .insert({
      company_id: auth.membership!.companyId,
      task_id: taskId,
      staff_profile_id: staffProfileId,
      team_id: teamId ?? (staff as any)?.primary_team_id ?? null,
      shift_id: shiftId,
      planned_start_at: plannedStartAt,
      planned_end_at: plannedEndAt,
      status: value(formData, 'status') ?? 'assigned',
      source_type: 'manual',
      is_locked: value(formData, 'is_locked') === 'true',
      locked_reason: value(formData, 'locked_reason'),
      override_reason: overrideReason,
      conflict_override_approved: overrideSoft,
      explanation: evaluation.explanation,
      metadata: { score: evaluation.score, conflictLevel: conflictLevel(evaluation.conflicts), source: 'manual_assignment_form' },
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  if (evaluation.conflicts.length > 0) {
    const { error: conflictError } = await supabaseAdmin.from('planning_conflicts').insert(evaluation.conflicts.map((conflict) => ({
      company_id: auth.membership!.companyId,
      task_assignment_id: assignment.id,
      task_id: taskId,
      staff_profile_id: staffProfileId,
      team_id: teamId ?? (staff as any)?.primary_team_id ?? null,
      shift_id: shiftId,
      conflict_type: conflict.conflictType,
      severity: conflict.severity,
      status: ['soft', 'warning'].includes(conflict.severity) && overrideSoft ? 'overridden' : 'open',
      message: conflict.message,
      details: conflict.details ?? {},
      resolved_by: ['soft', 'warning'].includes(conflict.severity) && overrideSoft ? auth.userId : null,
      resolved_at: ['soft', 'warning'].includes(conflict.severity) && overrideSoft ? new Date().toISOString() : null,
    })))
    if (conflictError) throw new Error(conflictError.message)
  }

  await supabaseAdmin
    .from('tasks')
    .update({
      assigned_staff_id: staffProfileId,
      assigned_team_id: teamId ?? (staff as any)?.primary_team_id ?? (task as any).assigned_team_id ?? null,
      scheduled_start: plannedStartAt,
      scheduled_end: plannedEndAt,
      status: 'assigned',
      updated_by: auth.userId,
    })
    .eq('id', taskId)
    .eq('company_id', auth.membership!.companyId)

  await supabaseAdmin.from('task_status_history').insert({ company_id: auth.membership!.companyId, task_id: taskId, old_status: (task as any).status, new_status: 'assigned', reason: 'Manuell tilldelning via Batch 8B', changed_by: auth.userId })

  if (shift?.id) await recalculateShiftAssignmentCapacity(auth.membership!.companyId, shift.id)

  await audit(auth.membership!.companyId, auth.userId, 'create', 'task_assignment', assignment.id, { taskId, staffProfileId, teamId, shiftId, score: evaluation.score, softOverride: overrideSoft })
  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
  revalidatePath('/planning')
  redirect(`/tasks/${taskId}`)
}

export async function createPlanningRunAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa planeringskörning')
  const dateFrom = value(formData, 'date_from')
  const dateTo = value(formData, 'date_to') ?? dateFrom
  if (!dateFrom || !dateTo) throw new Error('Datumintervall krävs.')

  const result = await createPlanningRunWithDraft({
    companyId: auth.membership!.companyId,
    actorUserId: auth.userId,
    name: value(formData, 'name'),
    dateFrom,
    dateTo,
    teamId: value(formData, 'team_id'),
    staffProfileId: value(formData, 'staff_profile_id'),
    taskTypeId: value(formData, 'task_type_id'),
    industryType: auth.membership?.industryType ?? null,
    areaLabel: value(formData, 'area_label'),
    unscheduledOnly: value(formData, 'unscheduled_only') !== 'false',
    includeLockedAssignments: value(formData, 'include_locked_assignments') !== 'false',
  })

  await audit(auth.membership!.companyId, auth.userId, 'create', 'planning_run', result.runId, result)
  revalidatePath('/planning')
  revalidatePath('/planning/runs')
  redirect(`/planning/runs/${result.runId}`)
}

export async function publishPlanningDraftAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att publicera planeringsutkast')
  const draftId = value(formData, 'draft_id')
  if (!draftId) throw new Error('Planeringsutkast saknas.')

  const selected = formValues(formData, 'draft_item_ids')
  const result = await publishPlanningDraft({
    companyId: auth.membership!.companyId,
    actorUserId: auth.userId,
    draftId,
    selectedDraftItemIds: selected.length ? selected : undefined,
    lockAssignments: value(formData, 'lock_assignments') === 'true',
  })

  await audit(auth.membership!.companyId, auth.userId, 'publish', 'planning_draft', draftId, result)
  revalidatePath('/planning')
  revalidatePath('/planning/runs')
  redirect('/planning')
}

export async function updatePlanningDraftItemAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att uppdatera planeringsrad')
  const itemId = value(formData, 'id')
  const draftId = value(formData, 'planning_draft_id')
  if (!itemId || !draftId) throw new Error('Planeringsrad saknas.')

  const { error } = await supabaseAdmin
    .from('planning_draft_items')
    .update({
      staff_profile_id: value(formData, 'staff_profile_id'),
      team_id: value(formData, 'team_id'),
      shift_id: value(formData, 'shift_id'),
      planned_start_at: value(formData, 'planned_start_at'),
      planned_end_at: value(formData, 'planned_end_at'),
      status: value(formData, 'status') ?? 'proposed',
      is_locked: value(formData, 'is_locked') === 'true',
      locked_reason: value(formData, 'locked_reason'),
      explanation: value(formData, 'explanation'),
      metadata: { manual_edit: true, edited_at: new Date().toISOString() },
    })
    .eq('id', itemId)
    .eq('planning_draft_id', draftId)
    .eq('company_id', auth.membership!.companyId)

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'update', 'planning_draft_item', itemId, { draftId })
  revalidatePath('/planning')
  revalidatePath('/planning/runs')
}

export async function resolvePlanningConflictAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att lösa planeringskonflikt')
  const conflictId = value(formData, 'id')
  const reason = value(formData, 'reason')
  const resolutionType = value(formData, 'resolution_type') ?? 'resolved'
  if (!conflictId) throw new Error('Konflikt-id saknas.')

  const { data: conflict } = await supabaseAdmin
    .from('planning_conflicts')
    .select('id')
    .eq('id', conflictId)
    .eq('company_id', auth.membership!.companyId)
    .maybeSingle()
  if (!conflict) throw new Error('Konflikten kunde inte hittas.')

  const { error } = await supabaseAdmin
    .from('planning_conflicts')
    .update({ status: resolutionType === 'override' ? 'overridden' : 'resolved', resolved_by: auth.userId, resolved_at: new Date().toISOString() })
    .eq('id', conflictId)
    .eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)

  const { error: resolutionError } = await supabaseAdmin.from('planning_conflict_resolutions').insert({
    company_id: auth.membership!.companyId,
    conflict_id: conflictId,
    resolution_type: resolutionType,
    reason,
    resolved_by: auth.userId,
  })
  if (resolutionError) throw new Error(resolutionError.message)

  await audit(auth.membership!.companyId, auth.userId, 'resolve', 'planning_conflict', conflictId, { resolutionType })
  revalidatePath('/planning')
  revalidatePath('/planning/runs')
}

export async function switchActiveCompanyAction(formData: FormData) {
  const auth = await requireAuth()
  const membershipId = value(formData, 'membership_id')
  if (!membershipId) throw new Error('Membership saknas.')

  const { data: membership, error } = await supabaseAdmin
    .from('company_memberships')
    .select('id, company_id')
    .eq('id', membershipId)
    .eq('user_id', auth.userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!membership) throw new Error('Du har inte åtkomst till detta företag.')

  await supabaseAdmin.from('company_memberships').update({ is_default: false }).eq('user_id', auth.userId)
  const { error: updateError } = await supabaseAdmin.from('company_memberships').update({ is_default: true }).eq('id', membership.id)
  if (updateError) throw new Error(updateError.message)

  await audit(membership.company_id, auth.userId, 'switch', 'company_membership', membership.id)
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function createCompanyWorkspaceAction(formData: FormData) {
  const auth = await requireAuth()
  const name = value(formData, 'name')
  const industryType = value(formData, 'industry_type') ?? 'other'
  const operationalModel = value(formData, 'operational_model') ?? 'case_based'
  if (!name) throw new Error('Företagsnamn krävs.')

  const slugBase = name.toLowerCase().trim().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const slug = `${slugBase}-${Math.random().toString(36).slice(2, 7)}`

  const { data: company, error } = await supabaseAdmin
    .from('companies')
    .insert({ name, slug, status: 'active', industry_type: industryType, operational_model: operationalModel })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  await supabaseAdmin.from('company_settings').insert({
    company_id: company.id,
    active_modules: ['foundation', 'industry_engine', 'resources', 'entities', 'tasks', 'audit_control', 'document_storage'],
    ui_label_set: industryType,
  })

  await supabaseAdmin.from('company_memberships').update({ is_default: false }).eq('user_id', auth.userId)
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .insert({ company_id: company.id, user_id: auth.userId, role: 'company_admin', status: 'active', is_default: true })
    .select('id')
    .single()
  if (membershipError) throw new Error(membershipError.message)

  const { data: team } = await supabaseAdmin
    .from('teams')
    .insert({ company_id: company.id, name: 'Huvudteam', status: 'active' })
    .select('id')
    .single()

  if (team?.id) {
    await supabaseAdmin.from('team_memberships').insert({ team_id: team.id, membership_id: membership.id, is_primary: true })
  }

  await supabaseAdmin.rpc('ensure_company_industry_defaults', { target_company_id: company.id }).throwOnError()
  await audit(company.id, auth.userId, 'create', 'company_workspace', company.id, { name, industryType, operationalModel })
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function createCompanyAccessRequestAction(formData: FormData) {
  const auth = await requireAuth()
  const companyName = value(formData, 'company_name')
  const message = value(formData, 'message')
  const requestType = value(formData, 'request_type') ?? 'join_existing'
  if (!companyName) throw new Error('Företagsnamn krävs.')

  const { data, error } = await supabaseAdmin
    .from('company_access_requests')
    .insert({ requester_user_id: auth.userId, requester_email: auth.email, company_name: companyName, request_type: requestType, message, status: 'pending' })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  if (auth.membership?.companyId) {
    await audit(auth.membership.companyId, auth.userId, 'request', 'company_access_request', data.id, { companyName, requestType })
  }
  revalidatePath('/settings/companies')
}

export async function createPropertyEmailChannelAction(formData: FormData) {
  const auth = await requireMembership('operations_manager', 'att hantera felanmälansmejl')
  const inboundEmail = value(formData, 'inbound_email')?.toLowerCase()
  if (!inboundEmail) throw new Error('E-postadress krävs.')

  const { data, error } = await supabaseAdmin
    .from('property_email_channels')
    .upsert({
      company_id: auth.membership!.companyId,
      inbound_email: inboundEmail,
      display_name: value(formData, 'display_name') ?? 'Felanmälan',
      status: value(formData, 'status') ?? 'active',
      create_service_request: value(formData, 'create_service_request') !== 'false',
      updated_by: auth.userId,
    }, { onConflict: 'company_id,inbound_email' })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'upsert', 'property_email_channel', data.id, { inboundEmail })
  revalidatePath('/property')
}

export async function createInboundEmailAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att registrera inkommande mejl')
  const fromEmail = value(formData, 'from_email')?.toLowerCase()
  const subject = value(formData, 'subject') ?? 'Felanmälan'
  const bodyText = value(formData, 'body_text')
  if (!fromEmail) throw new Error('Avsändarmejl krävs.')

  let matchedEntityId: string | null = null
  const { data: contacts } = await supabaseAdmin
    .from('entity_contacts')
    .select('id, entity_id, email, entities!inner(id, company_id, name)')
    .ilike('email', fromEmail)
    .limit(10)

  const matched = (contacts ?? []).find((contact: any) => contact.entities?.company_id === auth.membership!.companyId)
  if (matched?.entity_id) matchedEntityId = matched.entity_id

  let serviceRequestId: string | null = null
  const { data: serviceRequest, error: serviceError } = await supabaseAdmin
    .from('service_requests')
    .insert({
      company_id: auth.membership!.companyId,
      entity_id: matchedEntityId,
      title: subject,
      description: bodyText,
      request_type: 'property_fault',
      priority: value(formData, 'priority') ?? 'normal',
      status: 'open',
      source: 'email',
      reported_by_email: fromEmail,
      reported_by_name: value(formData, 'from_name'),
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select('id')
    .single()
  if (serviceError) throw new Error(serviceError.message)
  serviceRequestId = serviceRequest.id

  const { data, error } = await supabaseAdmin
    .from('inbound_emails')
    .insert({
      company_id: auth.membership!.companyId,
      from_email: fromEmail,
      from_name: value(formData, 'from_name'),
      subject,
      body_text: bodyText,
      matched_entity_id: matchedEntityId,
      service_request_id: serviceRequestId,
      status: matchedEntityId ? 'matched' : 'unmatched',
      raw_payload: { manual: true },
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  await audit(auth.membership!.companyId, auth.userId, 'ingest', 'inbound_email', data.id, { fromEmail, matchedEntityId, serviceRequestId })
  revalidatePath('/property')
  revalidatePath('/work-orders')
}

export async function createEntityContactAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa objektkontakt')
  const entityId = value(formData, 'entity_id')
  const name = value(formData, 'name')
  if (!entityId || !name) throw new Error('Objekt och namn krävs.')

  const { data: entity } = await supabaseAdmin.from('entities').select('id').eq('id', entityId).eq('company_id', auth.membership!.companyId).maybeSingle()
  if (!entity) throw new Error('Objektet kunde inte hittas.')

  const { data, error } = await supabaseAdmin
    .from('entity_contacts')
    .insert({
      entity_id: entityId,
      name,
      role_label: value(formData, 'role_label'),
      email: value(formData, 'email')?.toLowerCase(),
      phone: value(formData, 'phone'),
      is_primary: value(formData, 'is_primary') === 'true',
      notes: value(formData, 'notes'),
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'entity_contact', data.id, { entityId, name })
  revalidatePath(`/entities/${entityId}`)
}

function normalizeTimePart(time: string | null) {
  const raw = time?.trim()
  if (!raw) return null
  const match = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return `${match[1]}:${match[2]}`
}

function addDaysToDateString(date: string, days: number) {
  const cursor = new Date(`${date}T00:00:00Z`)
  cursor.setUTCDate(cursor.getUTCDate() + days)
  return cursor.toISOString().slice(0, 10)
}

function combineDateTime(date: string | null, time: string | null) {
  const normalizedTime = normalizeTimePart(time)
  if (!date || !normalizedTime) return null
  return `${date}T${normalizedTime}:00`
}

function combineShiftDateTimeRange(date: string | null, startTime: string | null, endTime: string | null) {
  const normalizedStartTime = normalizeTimePart(startTime)
  const normalizedEndTime = normalizeTimePart(endTime)
  if (!date || !normalizedStartTime || !normalizedEndTime) return null

  const endDate = normalizedEndTime <= normalizedStartTime ? addDaysToDateString(date, 1) : date
  const startsAt = `${date}T${normalizedStartTime}:00`
  const endsAt = `${endDate}T${normalizedEndTime}:00`

  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return null

  return {
    startTime: normalizedStartTime,
    endTime: normalizedEndTime,
    startsAt,
    endsAt,
  }
}

function requireShiftDateTimeRange(date: string | null, startTime: string | null, endTime: string | null) {
  const range = combineShiftDateTimeRange(date, startTime, endTime)
  if (!date || !normalizeTimePart(startTime) || !normalizeTimePart(endTime)) {
    throw new FormActionValidationError('Datum, starttid och sluttid krävs.', {
      shift_date: !date ? 'Välj datum.' : undefined,
      date_from: !date ? 'Välj från datum.' : undefined,
      start_time: !normalizeTimePart(startTime) ? 'Ange giltig starttid.' : undefined,
      end_time: !normalizeTimePart(endTime) ? 'Ange giltig sluttid.' : undefined,
    })
  }
  if (!range) {
    throw new FormActionValidationError('Tiderna kunde inte tolkas korrekt.', {
      start_time: 'Kontrollera starttid.',
      end_time: 'Kontrollera sluttid.',
    })
  }
  return range
}

function minutesBetween(startIso: string, endIso: string) {
  const diff = new Date(endIso).getTime() - new Date(startIso).getTime()
  return Number.isFinite(diff) ? Math.max(0, Math.round(diff / 60000)) : 0
}

function computeCapacity(startIso: string, endIso: string, breakMinutes: number, bufferMinutes: number) {
  const total = minutesBetween(startIso, endIso)
  const capacity = Math.max(0, total - Math.max(0, breakMinutes) - Math.max(0, bufferMinutes))
  return { total, capacity, remaining: capacity }
}

async function refreshAvailabilityConflicts(companyId: string, actorUserId: string, staffProfileId?: string | null, teamId?: string | null) {
  let shiftQuery = supabaseAdmin
    .from('shifts')
    .select('id, staff_profile_id, team_id, starts_at, ends_at, shift_date, title')
    .eq('company_id', companyId)
    .is('archived_at', null)
    .limit(250)

  if (staffProfileId) shiftQuery = shiftQuery.eq('staff_profile_id', staffProfileId)
  if (teamId) shiftQuery = shiftQuery.eq('team_id', teamId)

  const { data: shifts } = await shiftQuery
  const openShiftIds = (shifts ?? []).map((shift: any) => shift.id)

  if (openShiftIds.length) {
    await supabaseAdmin
      .from('availability_conflicts')
      .update({ archived_at: new Date().toISOString(), status: 'superseded' })
      .eq('company_id', companyId)
      .in('shift_id', openShiftIds)
      .is('archived_at', null)
  }

  for (const shift of shifts ?? []) {
    const issues: Array<{ type: string; severity: string; message: string; details?: Record<string, unknown> }> = []
    if (!shift.staff_profile_id && !shift.team_id) issues.push({ type: 'missing_target', severity: 'warning', message: 'Passet saknar både personal och team.' })

    if (shift.staff_profile_id) {
      const { data: absences } = await supabaseAdmin
        .from('absences')
        .select('id, starts_at, ends_at, reason')
        .eq('company_id', companyId)
        .eq('staff_profile_id', shift.staff_profile_id)
        .eq('affects_planning', true)
        .is('archived_at', null)
        .lt('starts_at', shift.ends_at)
        .gt('ends_at', shift.starts_at)
        .limit(10)
      if (absences?.length) issues.push({ type: 'absence_overlap', severity: 'critical', message: 'Personalens frånvaro överlappar passet.', details: { absenceIds: absences.map((a: any) => a.id) } })

      const { data: overlaps } = await supabaseAdmin
        .from('shifts')
        .select('id')
        .eq('company_id', companyId)
        .eq('staff_profile_id', shift.staff_profile_id)
        .is('archived_at', null)
        .neq('id', shift.id)
        .lt('starts_at', shift.ends_at)
        .gt('ends_at', shift.starts_at)
        .limit(10)
      if (overlaps?.length) issues.push({ type: 'shift_overlap', severity: 'critical', message: 'Personalen har överlappande pass.', details: { shiftIds: overlaps.map((s: any) => s.id) } })
    }

    for (const issue of issues) {
      await supabaseAdmin.from('availability_conflicts').insert({
        company_id: companyId,
        conflict_type: issue.type,
        severity: issue.severity,
        staff_profile_id: shift.staff_profile_id,
        team_id: shift.team_id,
        shift_id: shift.id,
        message: issue.message,
        details: issue.details ?? {},
      })
    }
  }

  await audit(companyId, actorUserId, 'refresh', 'availability_conflicts', null, { staffProfileId, teamId })
}

async function createShiftCore(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa pass')
  const date = value(formData, 'shift_date')
  const { startsAt, endsAt } = requireShiftDateTimeRange(date, value(formData, 'start_time'), value(formData, 'end_time'))
  const breakMinutes = Number(value(formData, 'break_minutes') ?? 0)
  const bufferMinutes = Number(value(formData, 'buffer_minutes') ?? 0)
  const plannedMinutes = Number(value(formData, 'planned_minutes') ?? 0)
  const cap = computeCapacity(startsAt, endsAt, breakMinutes, bufferMinutes)

  const { data, error } = await supabaseAdmin.from('shifts').insert({
    company_id: auth.membership!.companyId,
    staff_profile_id: value(formData, 'staff_profile_id'),
    team_id: value(formData, 'team_id'),
    title: value(formData, 'title'),
    shift_date: date,
    starts_at: startsAt,
    ends_at: endsAt,
    status: value(formData, 'status') ?? 'planned',
    role_label: value(formData, 'role_label'),
    transport_mode: value(formData, 'transport_mode') ?? 'car',
    start_location_type: value(formData, 'start_location_type') ?? 'company_base',
    start_address_text: value(formData, 'start_address_text'),
    end_location_type: value(formData, 'end_location_type') ?? 'company_base',
    end_address_text: value(formData, 'end_address_text'),
    total_minutes: cap.total,
    break_minutes: breakMinutes,
    buffer_minutes: bufferMinutes,
    capacity_minutes: cap.capacity,
    planned_minutes: plannedMinutes,
    remaining_minutes: Math.max(0, cap.capacity - plannedMinutes),
    planning_locked: value(formData, 'planning_locked') === 'true',
    locked_reason: value(formData, 'locked_reason'),
    locked_by: value(formData, 'planning_locked') === 'true' ? auth.userId : null,
    locked_at: value(formData, 'planning_locked') === 'true' ? new Date().toISOString() : null,
    notes: value(formData, 'notes'),
    created_by: auth.userId,
    updated_by: auth.userId,
  }).select('id').single()
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'shift', data.id)
  await refreshAvailabilityConflicts(auth.membership!.companyId, auth.userId, value(formData, 'staff_profile_id'), value(formData, 'team_id'))
  revalidatePath('/schedule')
  return data.id as string
}

export async function createShiftAction(formData: FormData) {
  const shiftId = await createShiftCore(formData)
  redirect(`/schedule/${shiftId}`)
}

export async function createShiftFormAction(_previousState: unknown, formData: FormData) {
  try {
    const shiftId = await createShiftCore(formData)
    redirect(`/schedule/${shiftId}`)
  } catch (error) {
    if (isNextRedirectError(error)) throw error

    const validationError = error instanceof FormActionValidationError ? error : null
    return {
      ok: false,
      message: validationError?.message ?? errorMessage(error, 'Kunde inte skapa pass.'),
      fieldErrors: validationError?.fieldErrors ?? {},
      values: formDataSnapshot(formData),
    }
  }
}

export async function updateShiftAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att uppdatera pass')
  const id = value(formData, 'id')
  const date = value(formData, 'shift_date')
  if (!id) throw new Error('Pass-id saknas.')
  const { startsAt, endsAt } = requireShiftDateTimeRange(date, value(formData, 'start_time'), value(formData, 'end_time'))
  const breakMinutes = Number(value(formData, 'break_minutes') ?? 0)
  const bufferMinutes = Number(value(formData, 'buffer_minutes') ?? 0)
  const plannedMinutes = Number(value(formData, 'planned_minutes') ?? 0)
  const cap = computeCapacity(startsAt, endsAt, breakMinutes, bufferMinutes)
  const { error } = await supabaseAdmin.from('shifts').update({
    staff_profile_id: value(formData, 'staff_profile_id'),
    team_id: value(formData, 'team_id'),
    title: value(formData, 'title'),
    shift_date: date,
    starts_at: startsAt,
    ends_at: endsAt,
    status: value(formData, 'status') ?? 'planned',
    role_label: value(formData, 'role_label'),
    transport_mode: value(formData, 'transport_mode') ?? 'car',
    start_location_type: value(formData, 'start_location_type') ?? 'company_base',
    start_address_text: value(formData, 'start_address_text'),
    end_location_type: value(formData, 'end_location_type') ?? 'company_base',
    end_address_text: value(formData, 'end_address_text'),
    total_minutes: cap.total,
    break_minutes: breakMinutes,
    buffer_minutes: bufferMinutes,
    capacity_minutes: cap.capacity,
    planned_minutes: plannedMinutes,
    remaining_minutes: Math.max(0, cap.capacity - plannedMinutes),
    planning_locked: value(formData, 'planning_locked') === 'true',
    locked_reason: value(formData, 'locked_reason'),
    locked_by: value(formData, 'planning_locked') === 'true' ? auth.userId : null,
    locked_at: value(formData, 'planning_locked') === 'true' ? new Date().toISOString() : null,
    notes: value(formData, 'notes'),
    updated_by: auth.userId,
  }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'update', 'shift', id)
  await refreshAvailabilityConflicts(auth.membership!.companyId, auth.userId, value(formData, 'staff_profile_id'), value(formData, 'team_id'))
  revalidatePath('/schedule')
  revalidatePath(`/schedule/${id}`)
}

export async function archiveShiftAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att arkivera pass')
  const id = value(formData, 'id')
  if (!id) throw new Error('Pass-id saknas.')
  const { error } = await supabaseAdmin.from('shifts').update({ archived_at: new Date().toISOString(), status: 'archived', updated_by: auth.userId }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'shift', id)
  revalidatePath('/schedule')
  redirect('/schedule')
}

export async function createAbsenceAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa frånvaro')
  const staffProfileId = value(formData, 'staff_profile_id')
  const startsAt = value(formData, 'starts_at')
  const endsAt = value(formData, 'ends_at')
  if (!staffProfileId || !startsAt || !endsAt) throw new Error('Personal, start och slut krävs.')
  const { data, error } = await supabaseAdmin.from('absences').insert({
    company_id: auth.membership!.companyId,
    staff_profile_id: staffProfileId,
    absence_type_id: value(formData, 'absence_type_id'),
    starts_at: startsAt,
    ends_at: endsAt,
    is_all_day: value(formData, 'is_all_day') === 'true',
    status: value(formData, 'status') ?? 'approved',
    affects_planning: value(formData, 'affects_planning') !== 'false',
    reason: value(formData, 'reason'),
    created_by: auth.userId,
    updated_by: auth.userId,
  }).select('id').single()
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'absence', data.id, { staffProfileId })
  await refreshAvailabilityConflicts(auth.membership!.companyId, auth.userId, staffProfileId, null)
  revalidatePath('/absences')
  redirect(`/absences/${data.id}`)
}

export async function updateAbsenceAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att uppdatera frånvaro')
  const id = value(formData, 'id')
  if (!id) throw new Error('Frånvaro-id saknas.')
  const { data: existing } = await supabaseAdmin.from('absences').select('staff_profile_id').eq('id', id).eq('company_id', auth.membership!.companyId).maybeSingle()
  const { error } = await supabaseAdmin.from('absences').update({
    staff_profile_id: value(formData, 'staff_profile_id'),
    absence_type_id: value(formData, 'absence_type_id'),
    starts_at: value(formData, 'starts_at'),
    ends_at: value(formData, 'ends_at'),
    is_all_day: value(formData, 'is_all_day') === 'true',
    status: value(formData, 'status') ?? 'approved',
    affects_planning: value(formData, 'affects_planning') !== 'false',
    reason: value(formData, 'reason'),
    updated_by: auth.userId,
  }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'update', 'absence', id)
  await refreshAvailabilityConflicts(auth.membership!.companyId, auth.userId, value(formData, 'staff_profile_id') ?? (existing as any)?.staff_profile_id, null)
  revalidatePath('/absences')
  revalidatePath(`/absences/${id}`)
}

export async function archiveAbsenceAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att arkivera frånvaro')
  const id = value(formData, 'id')
  if (!id) throw new Error('Frånvaro-id saknas.')
  const { error } = await supabaseAdmin.from('absences').update({ archived_at: new Date().toISOString(), status: 'cancelled', updated_by: auth.userId }).eq('id', id).eq('company_id', auth.membership!.companyId)
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'absence', id)
  revalidatePath('/absences')
  redirect('/absences')
}

export async function createAvailabilityBlockAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa tillgänglighetsblock')
  const startsAt = value(formData, 'starts_at')
  const endsAt = value(formData, 'ends_at')
  if (!startsAt || !endsAt) throw new Error('Start och slut krävs.')
  const { error } = await supabaseAdmin.from('availability_blocks').insert({
    company_id: auth.membership!.companyId,
    staff_profile_id: value(formData, 'staff_profile_id'),
    team_id: value(formData, 'team_id'),
    starts_at: startsAt,
    ends_at: endsAt,
    block_type: value(formData, 'block_type') ?? 'unavailable',
    rule_type: value(formData, 'rule_type') ?? 'time',
    affects_planning: value(formData, 'affects_planning') !== 'false',
    notes: value(formData, 'notes'),
    created_by: auth.userId,
    updated_by: auth.userId,
  })
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'availability_block', null)
  revalidatePath('/availability')
}

export async function createAvailabilityTemplateAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa tillgänglighetsmall')
  const name = value(formData, 'name')
  const targetType = value(formData, 'target_type') ?? 'staff'
  if (!name) throw new Error('Mallnamn krävs.')
  const { data, error } = await supabaseAdmin.from('availability_templates').insert({
    company_id: auth.membership!.companyId,
    name,
    description: value(formData, 'description'),
    target_type: targetType,
    industry_code: auth.membership?.industryType ?? null,
    status: value(formData, 'status') ?? 'active',
    valid_from: value(formData, 'valid_from'),
    valid_to: value(formData, 'valid_to'),
    created_by: auth.userId,
    updated_by: auth.userId,
  }).select('id').single()
  if (error) throw new Error(error.message)

  const staffProfileId = value(formData, 'staff_profile_id')
  const teamId = value(formData, 'team_id')
  if (staffProfileId || teamId) {
    const { error: targetError } = await supabaseAdmin.from('availability_template_targets').insert({
      company_id: auth.membership!.companyId,
      template_id: data.id,
      target_type: staffProfileId ? 'staff' : 'team',
      staff_profile_id: staffProfileId,
      team_id: teamId,
    })
    if (targetError) throw new Error(targetError.message)
  }

  await audit(auth.membership!.companyId, auth.userId, 'create', 'availability_template', data.id, { name, targetType })
  revalidatePath('/availability/templates')
  redirect(`/availability/templates/${data.id}`)
}

export async function addAvailabilityTemplateItemAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att lägga till mallrad')
  const templateId = value(formData, 'template_id')
  if (!templateId) throw new Error('Mall-id saknas.')
  const { data: template } = await supabaseAdmin.from('availability_templates').select('id').eq('id', templateId).eq('company_id', auth.membership!.companyId).maybeSingle()
  if (!template) throw new Error('Mallen kunde inte hittas.')
  const start = value(formData, 'start_time')
  const end = value(formData, 'end_time')
  if (!start || !end) throw new Error('Start- och sluttid krävs.')
  const { error } = await supabaseAdmin.from('availability_template_items').insert({
    company_id: auth.membership!.companyId,
    template_id: templateId,
    weekday: Number(value(formData, 'weekday') ?? 1),
    title: value(formData, 'title'),
    start_time: start,
    end_time: end,
    break_minutes: Number(value(formData, 'break_minutes') ?? 0),
    buffer_minutes: Number(value(formData, 'buffer_minutes') ?? 0),
    capacity_minutes: value(formData, 'capacity_minutes') ? Number(value(formData, 'capacity_minutes')) : null,
    role_label: value(formData, 'role_label'),
    transport_mode: value(formData, 'transport_mode') ?? 'car',
    start_location_type: value(formData, 'start_location_type') ?? 'company_base',
    start_address_text: value(formData, 'start_address_text'),
    end_location_type: value(formData, 'end_location_type') ?? 'company_base',
    end_address_text: value(formData, 'end_address_text'),
    min_staff: value(formData, 'min_staff') ? Number(value(formData, 'min_staff')) : null,
    max_staff: value(formData, 'max_staff') ? Number(value(formData, 'max_staff')) : null,
    notes: value(formData, 'notes'),
  })
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'availability_template_item', templateId)
  revalidatePath(`/availability/templates/${templateId}`)
}

export async function applyAvailabilityTemplateAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att applicera tillgänglighetsmall')
  const templateId = value(formData, 'template_id')
  const fromDate = value(formData, 'applied_from')
  const toDate = value(formData, 'applied_to')
  if (!templateId || !fromDate || !toDate) throw new Error('Mall och datumintervall krävs.')

  const [{ data: template }, { data: items }, { data: targets }] = await Promise.all([
    supabaseAdmin.from('availability_templates').select('*').eq('id', templateId).eq('company_id', auth.membership!.companyId).is('archived_at', null).maybeSingle(),
    supabaseAdmin.from('availability_template_items').select('*').eq('template_id', templateId).eq('company_id', auth.membership!.companyId).is('archived_at', null),
    supabaseAdmin.from('availability_template_targets').select('*').eq('template_id', templateId).eq('company_id', auth.membership!.companyId).is('archived_at', null),
  ])
  if (!template) throw new Error('Mallen kunde inte hittas.')
  if (!items?.length) throw new Error('Mallen saknar mallrader.')
  if (!targets?.length) throw new Error('Mallen saknar personal/team som mål.')

  const createdIds: string[] = []
  let skipped = 0
  const cursor = new Date(`${fromDate}T00:00:00`)
  const end = new Date(`${toDate}T00:00:00`)

  while (cursor <= end) {
    const weekday = cursor.getDay() === 0 ? 7 : cursor.getDay()
    const dateString = cursor.toISOString().slice(0, 10)
    for (const item of items as any[]) {
      if (Number(item.weekday) !== weekday) continue
      for (const target of targets as any[]) {
        const range = combineShiftDateTimeRange(dateString, String(item.start_time ?? ''), String(item.end_time ?? ''))
        if (!range) { skipped += 1; continue }
        const { startsAt, endsAt } = range
        const { data: existing } = await supabaseAdmin
          .from('shifts')
          .select('id')
          .eq('company_id', auth.membership!.companyId)
          .eq('shift_date', dateString)
          .eq('starts_at', startsAt)
          .eq('ends_at', endsAt)
          .eq('source_template_id', templateId)
          .eq(target.staff_profile_id ? 'staff_profile_id' : 'team_id', target.staff_profile_id ?? target.team_id)
          .is('archived_at', null)
          .maybeSingle()
        if (existing) { skipped += 1; continue }
        const total = minutesBetween(startsAt, endsAt)
        const capacity = item.capacity_minutes ?? Math.max(0, total - Number(item.break_minutes ?? 0) - Number(item.buffer_minutes ?? 0))
        const { data: shift, error } = await supabaseAdmin.from('shifts').insert({
          company_id: auth.membership!.companyId,
          staff_profile_id: target.staff_profile_id,
          team_id: target.team_id,
          title: item.title ?? template.name,
          shift_date: dateString,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'planned',
          role_label: item.role_label,
          transport_mode: item.transport_mode ?? 'car',
          start_location_type: item.start_location_type ?? 'company_base',
          start_address_text: item.start_address_text,
          end_location_type: item.end_location_type ?? 'company_base',
          end_address_text: item.end_address_text,
          total_minutes: total,
          break_minutes: Number(item.break_minutes ?? 0),
          buffer_minutes: Number(item.buffer_minutes ?? 0),
          capacity_minutes: capacity,
          remaining_minutes: capacity,
          source: 'availability_template',
          source_template_id: templateId,
          notes: item.notes,
          created_by: auth.userId,
          updated_by: auth.userId,
        }).select('id').single()
        if (error) throw new Error(error.message)
        createdIds.push(shift.id)
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  const { data: app, error: appError } = await supabaseAdmin.from('availability_template_applications').insert({
    company_id: auth.membership!.companyId,
    template_id: templateId,
    applied_from: fromDate,
    applied_to: toDate,
    target_summary: { targetCount: targets.length, itemCount: items.length },
    created_shift_ids: createdIds,
    skipped_count: skipped,
    applied_by: auth.userId,
  }).select('id').single()
  if (appError) throw new Error(appError.message)
  await audit(auth.membership!.companyId, auth.userId, 'apply', 'availability_template', templateId, { applicationId: app.id, created: createdIds.length, skipped })
  await refreshAvailabilityConflicts(auth.membership!.companyId, auth.userId, null, null)
  revalidatePath('/schedule')
  revalidatePath(`/availability/templates/${templateId}`)
}

export async function refreshAvailabilityConflictsAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att kontrollera tillgänglighetskonflikter')
  await refreshAvailabilityConflicts(auth.membership!.companyId, auth.userId, value(formData, 'staff_profile_id'), value(formData, 'team_id'))
  revalidatePath('/availability')
  revalidatePath('/schedule')
}

function formValues(formData: FormData, key: string) {
  return formData.getAll(key).filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim())
}

function weekdaysFromForm(formData: FormData) {
  const selected = formValues(formData, 'weekdays').map((day) => Number(day)).filter((day) => day >= 1 && day <= 7)
  return selected.length ? selected : [1, 2, 3, 4, 5]
}

function dateRange(fromDate: string, toDate: string) {
  const dates: string[] = []
  const cursor = new Date(`${fromDate}T00:00:00`)
  const end = new Date(`${toDate}T00:00:00`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function weekdayNumber(dateString: string) {
  const day = new Date(`${dateString}T00:00:00`).getDay()
  return day === 0 ? 7 : day
}

function combineShiftPresetDateTime(date: string, startTime: string, endTime: string) {
  const range = combineShiftDateTimeRange(date, startTime, endTime)
  if (!range) throw new FormActionValidationError('Start- och sluttid krävs.', { start_time: 'Ange giltig starttid.', end_time: 'Ange giltig sluttid.' })
  return { startsAt: range.startsAt, endsAt: range.endsAt }
}

function statusForBulk(valueFromForm: string | null) {
  return ['draft', 'planned', 'confirmed'].includes(valueFromForm ?? '') ? valueFromForm : 'draft'
}

async function loadShiftPresetForCompany(companyId: string, presetId: string | null, industryType: string | null) {
  if (!presetId || presetId === 'custom') return null
  const { data } = await supabaseAdmin
    .from('shift_presets')
    .select('*')
    .eq('id', presetId)
    .is('archived_at', null)
    .or(`company_id.eq.${companyId},preset_scope.eq.system`)
    .maybeSingle()

  if (!data) return null
  if (data.preset_scope === 'system' && data.industry_type && industryType && data.industry_type !== industryType) return null
  return data as any
}

async function createShiftFromBulkInput(params: {
  companyId: string
  actorUserId: string
  bulkRunId?: string | null
  bulkGroupId?: string | null
  presetId?: string | null
  source: string
  title: string | null
  shiftDate: string
  startTime: string
  endTime: string
  staffProfileId: string | null
  teamId: string | null
  status: string
  breakMinutes: number
  bufferMinutes: number
  plannedMinutes?: number
  transportMode: string
  startLocationType: string
  startAddressText: string | null
  endLocationType: string
  endAddressText: string | null
  roleLabel?: string | null
  planningLocked?: boolean
  notes?: string | null
  conflictMode?: string
}) {
  const { startsAt, endsAt } = combineShiftPresetDateTime(params.shiftDate, params.startTime, params.endTime)
  const cap = computeCapacity(startsAt, endsAt, params.breakMinutes, params.bufferMinutes)
  const plannedMinutes = params.plannedMinutes ?? 0
  const conflicts: string[] = []

  if (params.staffProfileId) {
    const [{ data: overlaps }, { data: absences }] = await Promise.all([
      supabaseAdmin
        .from('shifts')
        .select('id')
        .eq('company_id', params.companyId)
        .eq('staff_profile_id', params.staffProfileId)
        .is('archived_at', null)
        .lt('starts_at', endsAt)
        .gt('ends_at', startsAt)
        .limit(5),
      supabaseAdmin
        .from('absences')
        .select('id')
        .eq('company_id', params.companyId)
        .eq('staff_profile_id', params.staffProfileId)
        .eq('affects_planning', true)
        .is('archived_at', null)
        .lt('starts_at', endsAt)
        .gt('ends_at', startsAt)
        .limit(5),
    ])
    if (overlaps?.length) conflicts.push('Överlappande pass')
    if (absences?.length) conflicts.push('Frånvaro överlappar')
  }

  const hasBlockingConflict = conflicts.length > 0
  if ((params.conflictMode === 'skip_conflicts' || params.conflictMode === 'skip_blocking') && hasBlockingConflict) {
    return { shiftId: null, skipped: true, conflictSummary: conflicts.join(', '), startsAt, endsAt }
  }

  const { data, error } = await supabaseAdmin.from('shifts').insert({
    company_id: params.companyId,
    staff_profile_id: params.staffProfileId,
    team_id: params.teamId,
    title: params.title,
    shift_date: params.shiftDate,
    starts_at: startsAt,
    ends_at: endsAt,
    status: params.status,
    role_label: params.roleLabel ?? null,
    transport_mode: params.transportMode,
    start_location_type: params.startLocationType,
    start_address_text: params.startAddressText,
    end_location_type: params.endLocationType,
    end_address_text: params.endAddressText,
    total_minutes: cap.total,
    break_minutes: params.breakMinutes,
    buffer_minutes: params.bufferMinutes,
    capacity_minutes: cap.capacity,
    planned_minutes: plannedMinutes,
    remaining_minutes: Math.max(0, cap.capacity - plannedMinutes),
    planning_locked: Boolean(params.planningLocked),
    locked_by: params.planningLocked ? params.actorUserId : null,
    locked_at: params.planningLocked ? new Date().toISOString() : null,
    source: params.source,
    created_from: params.source,
    bulk_group_id: params.bulkGroupId,
    bulk_run_id: params.bulkRunId,
    source_preset_id: params.presetId,
    notes: params.notes,
    created_by: params.actorUserId,
    updated_by: params.actorUserId,
  }).select('id').single()

  if (error) throw new Error(error.message)
  return { shiftId: data.id as string, skipped: false, conflictSummary: conflicts.join(', '), startsAt, endsAt }
}

export async function createShiftPresetAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa passpreset')
  const name = value(formData, 'name')
  const startTime = value(formData, 'start_time')
  const endTime = value(formData, 'end_time')
  if (!name || !startTime || !endTime) throw new Error('Namn, starttid och sluttid krävs.')

  const { data, error } = await supabaseAdmin.from('shift_presets').insert({
    company_id: auth.membership!.companyId,
    industry_type: value(formData, 'industry_type') ?? auth.membership?.industryType ?? null,
    operational_model: auth.membership?.operationalModel ?? null,
    name,
    description: value(formData, 'description'),
    preset_scope: 'company',
    preset_type: value(formData, 'preset_type') ?? 'custom',
    start_time: startTime,
    end_time: endTime,
    break_minutes: Number(value(formData, 'break_minutes') ?? 0),
    buffer_minutes: Number(value(formData, 'buffer_minutes') ?? 0),
    transport_mode: value(formData, 'transport_mode') ?? 'car',
    start_location_type: value(formData, 'start_location_type') ?? 'company_base',
    start_address_text: value(formData, 'start_address_text'),
    end_location_type: value(formData, 'end_location_type') ?? 'company_base',
    end_address_text: value(formData, 'end_address_text'),
    default_status: statusForBulk(value(formData, 'default_status')),
    capacity_minutes: value(formData, 'capacity_minutes') ? Number(value(formData, 'capacity_minutes')) : null,
    min_staff: value(formData, 'min_staff') ? Number(value(formData, 'min_staff')) : null,
    max_staff: value(formData, 'max_staff') ? Number(value(formData, 'max_staff')) : null,
    default_team_id: value(formData, 'default_team_id'),
    metadata: { customLabel: value(formData, 'custom_label') },
    is_favorite: value(formData, 'is_favorite') === 'true',
    is_active: true,
    created_by: auth.userId,
    updated_by: auth.userId,
  }).select('id').single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'shift_preset', data.id, { name })
  revalidatePath('/availability/presets')
  redirect(`/availability/presets/${data.id}`)
}

export async function updateShiftPresetAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att uppdatera passpreset')
  const id = value(formData, 'id')
  const name = value(formData, 'name')
  const startTime = value(formData, 'start_time')
  const endTime = value(formData, 'end_time')
  if (!id || !name || !startTime || !endTime) throw new Error('Preset-id, namn, starttid och sluttid krävs.')

  const { error } = await supabaseAdmin.from('shift_presets').update({
    name,
    description: value(formData, 'description'),
    industry_type: value(formData, 'industry_type') ?? auth.membership?.industryType ?? null,
    preset_type: value(formData, 'preset_type') ?? 'custom',
    start_time: startTime,
    end_time: endTime,
    break_minutes: Number(value(formData, 'break_minutes') ?? 0),
    buffer_minutes: Number(value(formData, 'buffer_minutes') ?? 0),
    transport_mode: value(formData, 'transport_mode') ?? 'car',
    start_location_type: value(formData, 'start_location_type') ?? 'company_base',
    start_address_text: value(formData, 'start_address_text'),
    end_location_type: value(formData, 'end_location_type') ?? 'company_base',
    end_address_text: value(formData, 'end_address_text'),
    default_status: statusForBulk(value(formData, 'default_status')),
    capacity_minutes: value(formData, 'capacity_minutes') ? Number(value(formData, 'capacity_minutes')) : null,
    min_staff: value(formData, 'min_staff') ? Number(value(formData, 'min_staff')) : null,
    max_staff: value(formData, 'max_staff') ? Number(value(formData, 'max_staff')) : null,
    default_team_id: value(formData, 'default_team_id'),
    is_favorite: value(formData, 'is_favorite') === 'true',
    updated_by: auth.userId,
  }).eq('id', id).eq('company_id', auth.membership!.companyId).eq('preset_scope', 'company')

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'update', 'shift_preset', id, { name })
  revalidatePath('/availability/presets')
  revalidatePath(`/availability/presets/${id}`)
}

export async function archiveShiftPresetAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att arkivera passpreset')
  const id = value(formData, 'id')
  if (!id) throw new Error('Preset-id saknas.')
  const { error } = await supabaseAdmin.from('shift_presets').update({ archived_at: new Date().toISOString(), is_active: false, updated_by: auth.userId }).eq('id', id).eq('company_id', auth.membership!.companyId).eq('preset_scope', 'company')
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'archive', 'shift_preset', id)
  revalidatePath('/availability/presets')
  redirect('/availability/presets')
}

export async function duplicateSystemShiftPresetAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att duplicera systempreset')
  const id = value(formData, 'id')
  if (!id) throw new Error('Preset-id saknas.')
  const { data: preset } = await supabaseAdmin.from('shift_presets').select('*').eq('id', id).eq('preset_scope', 'system').is('archived_at', null).maybeSingle()
  if (!preset) throw new Error('Systempreset kunde inte hittas.')
  const { data, error } = await supabaseAdmin.from('shift_presets').insert({
    company_id: auth.membership!.companyId,
    industry_type: preset.industry_type ?? auth.membership?.industryType ?? null,
    operational_model: auth.membership?.operationalModel ?? null,
    name: `${preset.name} - egen`,
    description: preset.description,
    preset_scope: 'company',
    preset_type: preset.preset_type,
    start_time: preset.start_time,
    end_time: preset.end_time,
    break_minutes: preset.break_minutes,
    buffer_minutes: preset.buffer_minutes,
    transport_mode: preset.transport_mode,
    start_location_type: preset.start_location_type,
    start_address_text: preset.start_address_text,
    end_location_type: preset.end_location_type,
    end_address_text: preset.end_address_text,
    default_status: preset.default_status,
    capacity_minutes: preset.capacity_minutes,
    min_staff: preset.min_staff,
    max_staff: preset.max_staff,
    metadata: preset.metadata ?? {},
    created_by: auth.userId,
    updated_by: auth.userId,
  }).select('id').single()
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'duplicate', 'shift_preset', data.id, { sourcePresetId: id })
  revalidatePath('/availability/presets')
  redirect(`/availability/presets/${data.id}`)
}

async function bulkCreateShiftsCore(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa pass i bulk')
  const companyId = auth.membership!.companyId
  const presetId = value(formData, 'preset_id')
  const fromDate = value(formData, 'date_from') ?? value(formData, 'shift_date')
  const toDate = value(formData, 'date_to') ?? fromDate
  if (!fromDate || !toDate) {
    throw new FormActionValidationError('Datumintervall krävs.', {
      date_from: !fromDate ? 'Välj från datum.' : undefined,
      date_to: !toDate ? 'Välj till datum.' : undefined,
    })
  }

  const preset = await loadShiftPresetForCompany(companyId, presetId, auth.membership?.industryType ?? null)
  const customName = value(formData, 'custom_name')
  const title = preset?.name ?? customName ?? 'Eget pass'
  const rawStartTime = preset?.start_time ? String(preset.start_time).slice(0, 5) : value(formData, 'start_time')
  const rawEndTime = preset?.end_time ? String(preset.end_time).slice(0, 5) : value(formData, 'end_time')
  if (!rawStartTime || !rawEndTime) {
    throw new FormActionValidationError('Start- och sluttid krävs.', {
      start_time: !rawStartTime ? 'Ange starttid.' : undefined,
      end_time: !rawEndTime ? 'Ange sluttid.' : undefined,
    })
  }
  const validatedTimeRange = requireShiftDateTimeRange(fromDate, rawStartTime, rawEndTime)
  const startTime = validatedTimeRange.startTime
  const endTime = validatedTimeRange.endTime

  if (value(formData, 'save_custom_as_preset') === 'true' && !preset && customName) {
    await supabaseAdmin.from('shift_presets').insert({
      company_id: companyId,
      industry_type: auth.membership?.industryType ?? null,
      operational_model: auth.membership?.operationalModel ?? null,
      name: customName,
      description: 'Skapad från snabbflödet.',
      preset_scope: 'company',
      preset_type: 'custom',
      start_time: startTime,
      end_time: endTime,
      break_minutes: Number(value(formData, 'break_minutes') ?? 0),
      buffer_minutes: Number(value(formData, 'buffer_minutes') ?? 0),
      transport_mode: value(formData, 'transport_mode') ?? 'car',
      start_location_type: value(formData, 'start_location_type') ?? 'company_base',
      end_location_type: value(formData, 'end_location_type') ?? 'company_base',
      default_status: statusForBulk(value(formData, 'status')),
      created_by: auth.userId,
      updated_by: auth.userId,
    })
  }

  const selectedStaffIds = formValues(formData, 'staff_profile_ids')
  const selectedTeamIds = formValues(formData, 'team_ids')
  const includeTeamMembers = value(formData, 'include_team_members') === 'true'
  const weekdays = weekdaysFromForm(formData)
  const conflictMode = value(formData, 'conflict_mode') ?? 'skip_blocking'
  const bulkGroupId = crypto.randomUUID()
  const breakMinutes = Number(preset?.break_minutes ?? value(formData, 'break_minutes') ?? 0)
  const bufferMinutes = Number(preset?.buffer_minutes ?? value(formData, 'buffer_minutes') ?? 0)
  const transportMode = preset?.transport_mode ?? value(formData, 'transport_mode') ?? 'car'
  const status = statusForBulk(value(formData, 'status') ?? preset?.default_status ?? null) ?? 'draft'

  const staffIds = new Set(selectedStaffIds)
  if (includeTeamMembers && selectedTeamIds.length) {
    const { data: memberships } = await supabaseAdmin
      .from('staff_profiles')
      .select('id, primary_team_id')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .in('primary_team_id', selectedTeamIds)
    for (const member of (memberships ?? []) as Array<{ id: string }>) staffIds.add(member.id)
  }

  const targets: Array<{ staffProfileId: string | null; teamId: string | null }> = []
  for (const staffId of staffIds) targets.push({ staffProfileId: staffId, teamId: selectedTeamIds[0] ?? preset?.default_team_id ?? null })
  if (!targets.length && selectedTeamIds.length) {
    for (const teamId of selectedTeamIds) targets.push({ staffProfileId: null, teamId })
  }
  if (!targets.length) {
    throw new FormActionValidationError('Välj minst en personal eller ett team.', {
      staff_profile_ids: 'Välj minst en personal eller ett team.',
      team_ids: 'Välj minst en personal eller ett team.',
      targets: 'Välj minst en personal eller ett team innan du skapar pass.',
    })
  }

  const targetStaffIds = [...staffIds]
  const { data: bulkRun, error: bulkError } = await supabaseAdmin.from('shift_bulk_runs').insert({
    company_id: companyId,
    preset_id: preset?.id ?? null,
    name: value(formData, 'bulk_name') ?? title,
    date_from: fromDate,
    date_to: toDate,
    weekdays,
    target_type: targetStaffIds.length && selectedTeamIds.length ? 'mixed' : targetStaffIds.length ? 'staff' : 'team',
    target_staff_ids: targetStaffIds,
    target_team_ids: selectedTeamIds,
    default_status: status,
    conflict_mode: conflictMode,
    created_by: auth.userId,
  }).select('id').single()
  if (bulkError) throw new Error(bulkError.message)

  let created = 0
  let skipped = 0
  let conflicts = 0
  const itemRows: Array<{
    company_id: string
    bulk_run_id: string
    shift_id: string | null
    staff_profile_id: string | null
    team_id: string | null
    shift_date: string
    starts_at: string
    ends_at: string
    status: string
    conflict_level: string | null
    conflict_summary: string | null
    skipped_reason: string | null
  }> = []

  for (const dateString of dateRange(fromDate, toDate)) {
    if (!weekdays.includes(weekdayNumber(dateString))) continue
    for (const target of targets) {
      const result = await createShiftFromBulkInput({
        companyId,
        actorUserId: auth.userId,
        bulkRunId: bulkRun.id,
        bulkGroupId,
        presetId: preset?.id ?? null,
        source: preset ? 'shift_preset' : 'quick_custom',
        title,
        shiftDate: dateString,
        startTime,
        endTime,
        staffProfileId: target.staffProfileId,
        teamId: target.teamId,
        status,
        breakMinutes,
        bufferMinutes,
        transportMode,
        startLocationType: preset?.start_location_type ?? value(formData, 'start_location_type') ?? 'company_base',
        startAddressText: preset?.start_address_text ?? value(formData, 'start_address_text'),
        endLocationType: preset?.end_location_type ?? value(formData, 'end_location_type') ?? 'company_base',
        endAddressText: preset?.end_address_text ?? value(formData, 'end_address_text'),
        roleLabel: value(formData, 'role_label'),
        planningLocked: value(formData, 'planning_locked') === 'true',
        notes: value(formData, 'notes'),
        conflictMode,
      })
      if (result.conflictSummary) conflicts += 1
      if (result.skipped) skipped += 1
      else created += 1
      itemRows.push({
        company_id: companyId,
        bulk_run_id: bulkRun.id,
        shift_id: result.shiftId,
        staff_profile_id: target.staffProfileId,
        team_id: target.teamId,
        shift_date: dateString,
        starts_at: result.startsAt,
        ends_at: result.endsAt,
        status: result.skipped ? 'skipped' : 'created',
        conflict_level: result.conflictSummary ? 'warning' : null,
        conflict_summary: result.conflictSummary || null,
        skipped_reason: result.skipped ? result.conflictSummary || 'Skippad enligt konfliktregel' : null,
      })
    }
  }

  if (itemRows.length) {
    const { error: itemError } = await supabaseAdmin.from('shift_bulk_run_items').insert(itemRows)
    if (itemError) throw new Error(itemError.message)
  }

  await supabaseAdmin.from('shift_bulk_runs').update({
    created_count: created,
    skipped_count: skipped,
    conflict_count: conflicts,
    summary: { targetCount: targets.length, weekdayCount: weekdays.length, requestedDates: dateRange(fromDate, toDate).length, bulkGroupId },
  }).eq('id', bulkRun.id).eq('company_id', companyId)

  await audit(companyId, auth.userId, 'bulk_create', 'shifts', bulkRun.id, { created, skipped, conflicts, presetId: preset?.id ?? null })
  await refreshAvailabilityConflicts(companyId, auth.userId, null, null)
  revalidatePath('/schedule')
  revalidatePath('/availability/presets')
  redirect(`/schedule?bulk_run=${bulkRun.id}`)
}

export async function bulkCreateShiftsAction(formData: FormData) {
  await bulkCreateShiftsCore(formData)
}

export async function bulkCreateShiftsFormAction(_previousState: unknown, formData: FormData) {
  try {
    await bulkCreateShiftsCore(formData)
    return {
      ok: true,
      message: 'Pass skapades.',
      fieldErrors: {},
      values: formDataSnapshot(formData),
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error

    const validationError = error instanceof FormActionValidationError ? error : null
    return {
      ok: false,
      message: validationError?.message ?? errorMessage(error, 'Kunde inte skapa pass.'),
      fieldErrors: validationError?.fieldErrors ?? {},
      values: formDataSnapshot(formData),
    }
  }
}


export async function quickAbsenceAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att skapa snabbfrånvaro')
  const staffProfileId = value(formData, 'staff_profile_id')
  const date = value(formData, 'absence_date') ?? new Date().toISOString().slice(0, 10)
  if (!staffProfileId) throw new Error('Personal krävs.')
  const reason = value(formData, 'reason') ?? 'Sjuk/frånvarande'
  const startsAt = `${date}T00:00:00`
  const endsAt = `${date}T23:59:00`

  let absenceTypeId = value(formData, 'absence_type_id')
  if (!absenceTypeId) {
    const { data: type } = await supabaseAdmin.from('absence_types').select('id').eq('company_id', auth.membership!.companyId).eq('code', 'sick').maybeSingle()
    absenceTypeId = type?.id ?? null
  }

  const { data, error } = await supabaseAdmin.from('absences').insert({
    company_id: auth.membership!.companyId,
    staff_profile_id: staffProfileId,
    absence_type_id: absenceTypeId,
    starts_at: startsAt,
    ends_at: endsAt,
    is_all_day: true,
    status: 'approved',
    affects_planning: true,
    reason,
    created_by: auth.userId,
    updated_by: auth.userId,
  }).select('id').single()
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'quick_create', 'absence', data.id, { staffProfileId, date })
  await refreshAvailabilityConflicts(auth.membership!.companyId, auth.userId, staffProfileId, null)
  revalidatePath('/absences')
  revalidatePath('/schedule')
}

export async function bulkUpdateShiftsAction(formData: FormData) {
  const auth = await requireMembership('planner', 'att massändra pass')
  const shiftIds = formValues(formData, 'shift_ids')
  if (!shiftIds.length) throw new Error('Välj minst ett pass.')
  const update: Record<string, unknown> = { updated_by: auth.userId }
  const status = value(formData, 'status')
  if (status) update.status = status
  const teamId = value(formData, 'team_id')
  if (teamId) update.team_id = teamId
  const planningLocked = value(formData, 'planning_locked')
  if (planningLocked) {
    update.planning_locked = planningLocked === 'true'
    update.locked_by = planningLocked === 'true' ? auth.userId : null
    update.locked_at = planningLocked === 'true' ? new Date().toISOString() : null
  }
  if (value(formData, 'archive') === 'true') {
    update.archived_at = new Date().toISOString()
    update.status = 'archived'
  }
  const { error } = await supabaseAdmin.from('shifts').update(update).eq('company_id', auth.membership!.companyId).in('id', shiftIds)
  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'bulk_update', 'shifts', null, { count: shiftIds.length, update })
  await refreshAvailabilityConflicts(auth.membership!.companyId, auth.userId, null, null)
  revalidatePath('/schedule')
}
