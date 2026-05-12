'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { assertCompanyPermission } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
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
