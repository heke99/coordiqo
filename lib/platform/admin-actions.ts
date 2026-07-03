'use server'

import { revalidatePath } from 'next/cache'

import { requirePlatformAdmin } from '@/lib/auth/guards'
import { toFriendlyError } from '@/lib/errors/friendly-error'
import { getIndustryProfile, getIndustryRegistry, invalidateIndustryRegistryCache } from '@/lib/industry/registry'
import { logAuditEvent } from '@/lib/platform/audit'
import { supabaseAdmin } from '@/lib/supabase/admin'

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

function normalizeIndustryCode(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

async function audit(companyId: string | null, actorUserId: string, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await logAuditEvent({ companyId, actorUserId, action, entityType, entityId, metadata })
}

// --- Industry registry management -------------------------------------------------

export async function createIndustryProfileAction(formData: FormData) {
  const auth = await requirePlatformAdmin()
  const rawCode = value(formData, 'code')
  const nameSv = value(formData, 'name_sv')
  if (!rawCode || !nameSv) throw new Error('Kod och svenskt namn krävs.')

  const code = normalizeIndustryCode(rawCode)
  if (!code) throw new Error('Koden innehåller inga giltiga tecken.')

  const { data: existing } = await supabaseAdmin.from('industry_types').select('code').eq('code', code).maybeSingle()
  if (existing) throw new Error('Det finns redan en bransch med denna kod.')

  const otherProfile = await getIndustryProfile('other')
  const defaultModel = value(formData, 'default_operational_model') ?? 'route_based'

  const { error } = await supabaseAdmin.from('industry_types').insert({
    code,
    name: nameSv,
    name_sv: nameSv,
    name_en: value(formData, 'name_en'),
    short_name_sv: value(formData, 'short_name_sv') ?? nameSv,
    description: value(formData, 'description_sv'),
    description_sv: value(formData, 'description_sv'),
    description_en: value(formData, 'description_en'),
    is_active: true,
    sort_order: Number(value(formData, 'sort_order') ?? 500),
    default_operational_model: defaultModel,
    allowed_operational_models: [defaultModel],
    terminology: otherProfile.terminology,
    task_types: otherProfile.taskTypes,
    resource_types: otherProfile.resourceTypes,
    statuses: otherProfile.statuses,
    planning_rules: otherProfile.planningRules,
    mobile_actions: otherProfile.mobileActions,
    feature_defaults: { all_core_modules: true },
  })
  if (error) throw toFriendlyError(error)

  // Give the new industry a complete onboarding template right away.
  const { data: template } = await supabaseAdmin.rpc('coordiqo_default_onboarding_template', { p_industry: code })
  if (template) {
    await supabaseAdmin.from('industry_types').update({ onboarding_template: template }).eq('code', code)
  }

  invalidateIndustryRegistryCache()
  await audit(null, auth.userId, 'industry.created', 'industry_type', code, { nameSv })
  revalidatePath('/admin/industries')
}

export async function updateIndustryProfileAction(formData: FormData) {
  const auth = await requirePlatformAdmin()
  const code = value(formData, 'code')
  if (!code) throw new Error('Branschkod saknas.')

  const update: Record<string, unknown> = {}
  const nameSv = value(formData, 'name_sv')
  if (nameSv) {
    update.name_sv = nameSv
    update.name = nameSv
  }
  const nameEn = value(formData, 'name_en')
  if (nameEn !== null) update.name_en = nameEn
  const shortNameSv = value(formData, 'short_name_sv')
  if (shortNameSv !== null) update.short_name_sv = shortNameSv
  const descriptionSv = value(formData, 'description_sv')
  if (descriptionSv !== null) {
    update.description_sv = descriptionSv
    update.description = descriptionSv
  }
  const sortOrder = value(formData, 'sort_order')
  if (sortOrder !== null) update.sort_order = Number(sortOrder)
  const defaultModel = value(formData, 'default_operational_model')
  if (defaultModel !== null) update.default_operational_model = defaultModel
  const isActive = value(formData, 'is_active')
  if (isActive !== null) {
    if (code === 'other' && isActive === 'false') throw new Error('Branschen "Annan verksamhet" måste vara aktiv som säkert standardval.')
    update.is_active = isActive === 'true'
    update.archived_at = isActive === 'true' ? null : new Date().toISOString()
  }

  const { error } = await supabaseAdmin.from('industry_types').update(update).eq('code', code)
  if (error) throw toFriendlyError(error)

  invalidateIndustryRegistryCache()
  await audit(null, auth.userId, 'industry.updated', 'industry_type', code, update)
  revalidatePath('/admin/industries')
}

// --- Company repair, industry change and commercial data -------------------------

export async function repairCompanyDefaultsAdminAction(formData: FormData) {
  const auth = await requirePlatformAdmin()
  const companyId = value(formData, 'company_id')
  if (!companyId) throw new Error('Bolag saknas.')

  const { error } = await supabaseAdmin.rpc('ensure_company_industry_defaults', { target_company_id: companyId })
  if (error) throw toFriendlyError(error)

  // Idempotently ensure an onboarding session exists.
  const { data: session } = await supabaseAdmin.from('company_onboarding_sessions').select('id').eq('company_id', companyId).maybeSingle()
  if (!session) {
    await supabaseAdmin.from('company_onboarding_sessions').insert({
      company_id: companyId,
      status: 'not_started',
      current_step: 'company_information',
      created_by: auth.userId,
    })
  }

  invalidateIndustryRegistryCache()
  await audit(companyId, auth.userId, 'company.defaults_repaired', 'company', companyId)
  revalidatePath(`/admin/companies/${companyId}`)
  revalidatePath('/admin/go-live')
}

export async function changeCompanyIndustryAction(formData: FormData) {
  const auth = await requirePlatformAdmin()
  const companyId = value(formData, 'company_id')
  const industryType = value(formData, 'industry_type')
  if (!companyId || !industryType) throw new Error('Bolag och bransch krävs.')

  const registry = await getIndustryRegistry()
  const profile = registry.find((entry) => entry.code === industryType)
  if (!profile) throw new Error('Branschen finns inte i branschregistret.')

  const operationalModel = value(formData, 'operational_model') ?? profile.defaultOperationalModel

  const { error } = await supabaseAdmin
    .from('companies')
    .update({ industry_type: industryType, operational_model: operationalModel })
    .eq('id', companyId)
  if (error) throw toFriendlyError(error)

  const { error: defaultsError } = await supabaseAdmin.rpc('ensure_company_industry_defaults', { target_company_id: companyId })
  if (defaultsError) throw toFriendlyError(defaultsError)

  invalidateIndustryRegistryCache()
  await audit(companyId, auth.userId, 'company.industry_changed', 'company', companyId, { industryType, operationalModel })
  revalidatePath(`/admin/companies/${companyId}`)
}

export async function updateCompanyCommercialAction(formData: FormData) {
  const auth = await requirePlatformAdmin()
  const companyId = value(formData, 'company_id')
  if (!companyId) throw new Error('Bolag saknas.')

  const update = {
    package_code: value(formData, 'package_code'),
    contract_status: value(formData, 'contract_status') ?? 'none',
    pilot_starts_on: value(formData, 'pilot_starts_on'),
    pilot_ends_on: value(formData, 'pilot_ends_on'),
    billing_contact_email: value(formData, 'billing_contact_email')?.toLowerCase() ?? null,
    billing_org_number: value(formData, 'billing_org_number'),
    renewal_date: value(formData, 'renewal_date'),
    cancellation_date: value(formData, 'cancellation_date'),
    commercial_notes: value(formData, 'commercial_notes'),
    sales_owner: value(formData, 'sales_owner'),
    customer_success_owner: value(formData, 'customer_success_owner'),
  }

  const { error } = await supabaseAdmin.from('companies').update(update).eq('id', companyId)
  if (error) throw toFriendlyError(error)

  await audit(companyId, auth.userId, 'company.commercial_updated', 'company', companyId, { packageCode: update.package_code, contractStatus: update.contract_status })
  revalidatePath(`/admin/companies/${companyId}`)
}

export async function resendInvitationAdminAction(formData: FormData) {
  const auth = await requirePlatformAdmin()
  const id = value(formData, 'invitation_id')
  if (!id) throw new Error('Inbjudan saknas.')

  const { data: invitation, error } = await supabaseAdmin
    .from('company_invitations')
    .select('id, company_id, email, full_name, role, token, status, resend_count, companies(name)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw toFriendlyError(error)
  if (!invitation) throw new Error('Inbjudan kunde inte hittas.')
  if (invitation.status !== 'pending') throw new Error('Endast aktiva inbjudningar kan skickas om.')

  const companyName = (invitation as any).companies?.name ?? 'ert bolag'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const acceptUrl = `${siteUrl}/invite/accept?token=${invitation.token}`

  const { queueAndSendEmail } = await import('@/lib/email/outbound')
  const delivery = await queueAndSendEmail({
    companyId: invitation.company_id,
    to: invitation.email,
    subject: `Påminnelse: inbjudan till ${companyName} i Coordiqo`,
    bodyText: [
      `Hej${invitation.full_name ? ` ${invitation.full_name}` : ''},`,
      '',
      `Du har fortfarande en aktiv inbjudan till ${companyName}.`,
      '',
      `Acceptera inbjudan här: ${acceptUrl}`,
    ].join('\n'),
    relatedEntityType: 'company_invitation',
    relatedEntityId: invitation.id,
    createdBy: auth.userId,
  })

  await supabaseAdmin
    .from('company_invitations')
    .update({
      resend_count: Number(invitation.resend_count ?? 0) + 1,
      last_resent_at: new Date().toISOString(),
      email_delivery_status: delivery.status === 'sent' ? 'sent' : delivery.status === 'failed' ? 'failed' : 'queued',
    })
    .eq('id', id)

  await audit(invitation.company_id, auth.userId, 'invitation.resent_by_admin', 'company_invitation', id, { delivery: delivery.status })
  revalidatePath('/admin/demo-requests')
  revalidatePath(`/admin/companies/${invitation.company_id}`)
}

export async function repairAllMissingDefaultsAction() {
  const auth = await requirePlatformAdmin()

  const [{ data: companies }, { data: settings }, { data: runtimeConfigs }, { data: sessions }] = await Promise.all([
    supabaseAdmin.from('companies').select('id, name').eq('status', 'active').is('archived_at', null),
    supabaseAdmin.from('company_settings').select('company_id'),
    supabaseAdmin.from('industry_runtime_configs').select('company_id'),
    supabaseAdmin.from('company_onboarding_sessions').select('company_id'),
  ])

  const hasSettings = new Set((settings ?? []).map((row) => row.company_id))
  const hasRuntime = new Set((runtimeConfigs ?? []).map((row) => row.company_id))
  const hasSession = new Set((sessions ?? []).map((row) => row.company_id))

  const needsRepair = (companies ?? []).filter(
    (company) => !hasSettings.has(company.id) || !hasRuntime.has(company.id) || !hasSession.has(company.id),
  )

  for (const company of needsRepair) {
    await supabaseAdmin.rpc('ensure_company_industry_defaults', { target_company_id: company.id })
    if (!hasSession.has(company.id)) {
      await supabaseAdmin.from('company_onboarding_sessions').insert({
        company_id: company.id,
        status: 'not_started',
        current_step: 'company_information',
        created_by: auth.userId,
      })
    }
  }

  invalidateIndustryRegistryCache()
  await audit(null, auth.userId, 'platform.defaults_repaired', 'company', null, { repairedCount: needsRepair.length })
  revalidatePath('/admin/go-live')
  revalidatePath('/admin/health')
}
