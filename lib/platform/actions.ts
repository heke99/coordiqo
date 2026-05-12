'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { assertCompanyPermission } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { queueAndSendEmail } from '@/lib/email/outbound'
import { evaluateTaskAssignment } from '@/lib/planning/rule-engine'
import { supabaseAdmin } from '@/lib/supabase/admin'

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
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
  const auth = await requireMembership('operations_manager', 'att skapa kompetenser')
  const name = value(formData, 'name')
  const code = value(formData, 'code')?.toLowerCase().replace(/[^a-z0-9_\-]/g, '_')
  if (!name) throw new Error('Kompetensnamn krävs.')
  if (!code) throw new Error('Kompetenskod krävs.')

  const { data, error } = await supabaseAdmin
    .from('skills')
    .insert({
      company_id: auth.membership!.companyId,
      code,
      name,
      category: value(formData, 'category') ?? 'general',
      description: value(formData, 'description'),
      is_active: value(formData, 'is_active') !== 'false',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'skill', data.id, { code, name })
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
  const auth = await requireMembership('operations_manager', 'att skapa certifikat')
  const name = value(formData, 'name')
  const code = value(formData, 'code')?.toLowerCase().replace(/[^a-z0-9_\-]/g, '_')
  if (!name) throw new Error('Certifikatnamn krävs.')
  if (!code) throw new Error('Certifikatkod krävs.')

  const { data, error } = await supabaseAdmin
    .from('certifications')
    .insert({
      company_id: auth.membership!.companyId,
      code,
      name,
      category: value(formData, 'category') ?? 'general',
      description: value(formData, 'description'),
      requires_expiry: value(formData, 'requires_expiry') !== 'false',
      is_active: value(formData, 'is_active') !== 'false',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  await audit(auth.membership!.companyId, auth.userId, 'create', 'certification', data.id, { code, name })
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
