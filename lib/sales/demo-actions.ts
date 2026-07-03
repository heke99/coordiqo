'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isPlatformAdminRole, type CompanyRole } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { queueAndSendEmail } from '@/lib/email/outbound'
import { toFriendlyError } from '@/lib/errors/friendly-error'
import { allCompanyCoreModules, getIndustryPreset, uniqueOperationalModels } from '@/lib/industry/config'
import { getOnboardingProgress } from '@/lib/onboarding/progress'
import { logAuditEvent } from '@/lib/platform/audit'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEMO_SUPPORT_EMAIL = 'support@coordiqo.com'

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

function values(formData: FormData, key: string) {
  return formData.getAll(key).filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '').map((entry) => entry.trim())
}

function normalizeSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'company'
}

function normalizeLocale(input: string | null) {
  return input === 'en' ? 'en' : 'sv'
}

function assertStrongPassword(password: string) {
  if (password.length < 12) throw new Error('Tillfälligt lösenord måste vara minst 12 tecken.')
  if (!/[A-ZÅÄÖ]/.test(password)) throw new Error('Tillfälligt lösenord måste innehålla minst en stor bokstav.')
  if (!/[a-zåäö]/.test(password)) throw new Error('Tillfälligt lösenord måste innehålla minst en liten bokstav.')
  if (!/[0-9]/.test(password)) throw new Error('Tillfälligt lösenord måste innehålla minst en siffra.')
}

async function requirePlatformAdmin(label: string) {
  const auth = await requireAuth()
  if (!isPlatformAdminRole(auth.platformRole)) throw new Error(`Du saknar behörighet för ${label}.`)
  return auth
}

async function audit(companyId: string | null, actorUserId: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await logAuditEvent({ companyId, actorUserId, action, entityType, entityId, metadata })
}

export async function submitDemoRequestAction(formData: FormData) {
  const companyName = value(formData, 'company_name')
  const contactName = value(formData, 'contact_name')
  const email = value(formData, 'email')?.toLowerCase()
  const consent = formData.get('consent') === 'on'

  if (!companyName) throw new Error('Företagsnamn krävs.')
  if (!contactName) throw new Error('Kontaktperson krävs.')
  if (!email || !email.includes('@')) throw new Error('Giltig e-post krävs.')
  if (!consent) throw new Error('Du behöver godkänna att vi kontaktar dig om demo.')

  const payload = {
    company_name: companyName,
    organization_number: value(formData, 'organization_number'),
    contact_name: contactName,
    email,
    phone: value(formData, 'phone'),
    industry: value(formData, 'industry'),
    employee_count: value(formData, 'employee_count'),
    weekly_jobs_count: value(formData, 'weekly_jobs_count'),
    needs: values(formData, 'needs'),
    preferred_language: normalizeLocale(value(formData, 'preferred_language')),
    message: value(formData, 'message'),
    status: 'new',
    source: 'website',
  }

  const { data, error } = await supabaseAdmin.from('demo_requests').insert(payload).select('id').single()
  if (error) throw toFriendlyError(error)

  const lines = [
    'Ny demoansökan i Coordiqo',
    '',
    `Företag: ${payload.company_name}`,
    `Org.nr: ${payload.organization_number ?? '-'}`,
    `Kontakt: ${payload.contact_name}`,
    `E-post: ${payload.email}`,
    `Telefon: ${payload.phone ?? '-'}`,
    `Bransch: ${payload.industry ?? '-'}`,
    `Antal anställda: ${payload.employee_count ?? '-'}`,
    `Jobb/vecka: ${payload.weekly_jobs_count ?? '-'}`,
    `Behov: ${payload.needs.join(', ') || '-'}`,
    `Språk: ${payload.preferred_language}`,
    '',
    payload.message ? `Meddelande: ${payload.message}` : 'Meddelande: -',
  ]

  try {
    await queueAndSendEmail({
      companyId: null,
      to: DEMO_SUPPORT_EMAIL,
      subject: `Ny demoansökan: ${payload.company_name}`,
      bodyText: lines.join('\n'),
      relatedEntityType: 'demo_request',
      relatedEntityId: data.id,
    })

    if (process.env.RESEND_API_KEY) {
      await queueAndSendEmail({
        companyId: null,
        to: payload.email,
        subject: payload.preferred_language === 'en' ? 'We received your Coordiqo demo request' : 'Vi har tagit emot din demoansökan',
        bodyText: payload.preferred_language === 'en'
          ? `Hi ${payload.contact_name},\n\nThanks for your interest in Coordiqo. We will contact you shortly to qualify your company and book a demo.\n\nBest,\nCoordiqo`
          : `Hej ${payload.contact_name},\n\nTack för ditt intresse för Coordiqo. Vi kontaktar dig inom kort för att kvalificera bolaget och boka demo.\n\nVänligen,\nCoordiqo`,
        relatedEntityType: 'demo_request',
        relatedEntityId: data.id,
      })
    }
  } catch (emailError) {
    await audit(null, null, 'demo_request.email_failed', 'demo_request', data.id, {
      message: emailError instanceof Error ? emailError.message : 'unknown_email_error',
    })
  }

  redirect('/book-demo?success=1')
}

export async function updateDemoRequestAction(formData: FormData) {
  const auth = await requirePlatformAdmin('att hantera demoansökningar')
  const id = value(formData, 'id')
  if (!id) throw new Error('Demo request saknas.')
  const update = {
    status: value(formData, 'status') ?? 'new',
    assigned_to: value(formData, 'assigned_to'),
    next_contact_at: value(formData, 'next_contact_at') ? new Date(value(formData, 'next_contact_at')!).toISOString() : null,
  }
  const { error } = await supabaseAdmin.from('demo_requests').update(update).eq('id', id)
  if (error) throw toFriendlyError(error)
  await audit(null, auth.userId, 'demo_request.updated', 'demo_request', id, update)
  revalidatePath('/admin/demo-requests')
  revalidatePath(`/admin/demo-requests/${id}`)
}

export async function addDemoRequestNoteAction(formData: FormData) {
  const auth = await requirePlatformAdmin('att lägga intern leadnotering')
  const id = value(formData, 'demo_request_id')
  const note = value(formData, 'note')
  if (!id || !note) throw new Error('Lead och notering krävs.')
  const { error } = await supabaseAdmin.from('demo_request_notes').insert({ demo_request_id: id, note, created_by: auth.userId })
  if (error) throw toFriendlyError(error)
  await audit(null, auth.userId, 'demo_request.note_added', 'demo_request', id)
  revalidatePath(`/admin/demo-requests/${id}`)
}

export async function createCompanyFromDemoRequestAction(formData: FormData) {
  const auth = await requirePlatformAdmin('att skapa bolag från demoansökan')
  const requestId = value(formData, 'demo_request_id')
  if (!requestId) throw new Error('Demoansökan saknas.')

  const { data: request, error: requestError } = await supabaseAdmin.from('demo_requests').select('*').eq('id', requestId).maybeSingle()
  if (requestError) throw toFriendlyError(requestError)
  if (!request) throw new Error('Demoansökan kunde inte hittas.')
  if (request.created_company_id) throw new Error('Bolag är redan skapat för denna demoansökan.')

  if (request.organization_number) {
    const { data: existingOrg } = await supabaseAdmin.from('companies').select('id').eq('org_number', request.organization_number).maybeSingle()
    if (existingOrg) throw new Error('Ett bolag med detta organisationsnummer finns redan.')
  }

  const slugBase = normalizeSlug(request.company_name)
  let slug = slugBase
  let suffix = 0
  while (true) {
    const { data: existingSlug } = await supabaseAdmin.from('companies').select('id').eq('slug', slug).maybeSingle()
    if (!existingSlug) break
    suffix += 1
    slug = `${slugBase}-${suffix}`
  }

  const industryType = request.industry ?? 'other'
  const operationalModel = industryType === 'courier' ? 'delivery_based' : industryType === 'construction' ? 'project_based' : 'route_based'
  const locale = normalizeLocale(request.preferred_language)
  const { data: company, error: companyError } = await supabaseAdmin.from('companies').insert({
    name: request.company_name,
    slug,
    org_number: request.organization_number,
    status: 'active',
    lifecycle_status: 'active',
    industry_type: industryType,
    operational_model: operationalModel,
    language_code: locale,
    timezone: 'Europe/Stockholm',
    approved_by: auth.userId,
    approved_at: new Date().toISOString(),
  }).select('id').single()
  if (companyError) throw toFriendlyError(companyError)

  const preset = getIndustryPreset(industryType)
  const activeModules = allCompanyCoreModules()
  await supabaseAdmin.from('company_settings').upsert({
    company_id: company.id,
    active_modules: activeModules,
    ui_label_set: industryType,
    locale,
    timezone: 'Europe/Stockholm',
    currency: 'SEK',
  }, { onConflict: 'company_id' })

  await supabaseAdmin.from('industry_runtime_configs').upsert({
    company_id: company.id,
    industry_code: industryType,
    operational_model: operationalModel,
    terminology: preset.terminology,
    task_statuses: preset.statuses,
    mobile_actions: preset.mobileActions,
    planning_rules: preset.planningRules,
    settings: {
      primaryOperationalModel: operationalModel,
      enabledOperationalModels: uniqueOperationalModels(operationalModel, preset.operationalModels),
      allCoreModulesEnabled: true,
      note: 'Industry model prepares editable defaults only. It does not lock modules, templates, labels or workflows.',
    },
    updated_by: auth.userId,
  }, { onConflict: 'company_id' })

  await supabaseAdmin.rpc('ensure_company_industry_defaults', { target_company_id: company.id }).throwOnError()
  await supabaseAdmin.from('company_onboarding_sessions').insert({
    company_id: company.id,
    demo_request_id: request.id,
    status: 'not_started',
    current_step: 'company_information',
    settings: {
      selectedIndustry: industryType,
      selectedOperationalModel: operationalModel,
      editableDefaultsOnly: true,
    },
    created_by: auth.userId,
  })
  await supabaseAdmin.from('demo_requests').update({ created_company_id: company.id, status: 'onboarding_started' }).eq('id', request.id)
  await audit(company.id, auth.userId, 'demo_request.company_created', 'demo_request', request.id, { companyId: company.id, industryType, operationalModel })
  revalidatePath('/admin/demo-requests')
  revalidatePath(`/admin/demo-requests/${request.id}`)
}

export async function createCompanyAdminFromDemoRequestAction(formData: FormData) {
  const auth = await requirePlatformAdmin('att skapa company admin')
  const requestId = value(formData, 'demo_request_id')
  const companyId = value(formData, 'company_id')
  const fullName = value(formData, 'full_name')
  const email = value(formData, 'email')?.toLowerCase()
  const temporaryPassword = value(formData, 'temporary_password')
  const preferredLocale = normalizeLocale(value(formData, 'preferred_language'))
  const role = (value(formData, 'role') ?? 'company_admin') as CompanyRole

  if (!requestId || !companyId || !fullName || !email || !temporaryPassword) throw new Error('Bolag, namn, e-post och tillfälligt lösenord krävs.')
  if (role !== 'company_admin' && role !== 'operations_manager') throw new Error('Ogiltig adminroll.')
  assertStrongPassword(temporaryPassword)

  const { data: request } = await supabaseAdmin.from('demo_requests').select('id, created_company_id').eq('id', requestId).maybeSingle()
  if (!request || request.created_company_id !== companyId) throw new Error('Bolaget matchar inte demoansökan.')

  const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { created_by: 'coordiqo_superadmin', must_change_password: true },
  })
  if (createError) throw new Error(createError.message.includes('already') ? 'En användare med denna e-post finns redan.' : createError.message)
  const userId = createdUser.user?.id
  if (!userId) throw new Error('Supabase skapade ingen användare.')

  const now = new Date().toISOString()
  await supabaseAdmin.from('profiles').upsert({
    id: userId,
    email,
    full_name: fullName,
    preferred_locale: preferredLocale,
    must_change_password: true,
    created_by_superadmin: auth.userId,
    temporary_access_created_at: now,
  })
  await supabaseAdmin.from('company_memberships').upsert({
    company_id: companyId,
    user_id: userId,
    role,
    status: 'active',
    is_default: true,
    invited_by: auth.userId,
  }, { onConflict: 'company_id,user_id' })

  await audit(companyId, auth.userId, 'company_admin.temporary_user_created', 'profile', userId, { requestId, email, role })
  revalidatePath(`/admin/demo-requests/${requestId}`)
  revalidatePath(`/admin/companies/${companyId}`)
}

function canManageOnboarding(auth: Awaited<ReturnType<typeof requireAuth>>) {
  return (
    isPlatformAdminRole(auth.platformRole) ||
    auth.membership?.companyRole === 'company_admin' ||
    auth.membership?.companyRole === 'operations_manager'
  )
}

export async function updateOnboardingStepAction(formData: FormData) {
  const auth = await requireAuth()
  if (!auth.membership) redirect('/setup')
  if (!canManageOnboarding(auth)) throw new Error('Du saknar behörighet för att uppdatera onboarding.')

  const companyId = auth.membership.companyId
  const stepKey = value(formData, 'step_key')
  const markDone = value(formData, 'done') === 'true'
  if (!stepKey) throw new Error('Steget kunde inte identifieras. Ladda om sidan och försök igen.')

  const { data: session } = await supabaseAdmin
    .from('company_onboarding_sessions')
    .select('id, completed_steps, status')
    .eq('company_id', companyId)
    .maybeSingle()

  const currentSteps = new Set<string>((session?.completed_steps ?? []) as string[])
  if (markDone) currentSteps.add(stepKey)
  else currentSteps.delete(stepKey)

  const { error } = await supabaseAdmin.from('company_onboarding_sessions').upsert({
    company_id: companyId,
    status: session?.status === 'completed' ? 'completed' : 'in_progress',
    current_step: stepKey,
    completed_steps: Array.from(currentSteps),
    created_by: auth.userId,
  }, { onConflict: 'company_id' })
  if (error) throw toFriendlyError(error)

  await audit(companyId, auth.userId, markDone ? 'onboarding.step_completed' : 'onboarding.step_reopened', 'company_onboarding_session', companyId, { stepKey })
  revalidatePath('/onboarding')
  revalidatePath('/dashboard')
}

export async function repairOnboardingDefaultsAction() {
  const auth = await requireAuth()
  if (!auth.membership) redirect('/setup')
  if (!canManageOnboarding(auth)) throw new Error('Du saknar behörighet för att reparera standardinställningar.')

  const companyId = auth.membership.companyId
  const { error } = await supabaseAdmin.rpc('ensure_company_industry_defaults', { target_company_id: companyId })
  if (error) throw toFriendlyError(error, 'Standardinställningarna kunde inte skapas just nu. Försök igen.')

  await audit(companyId, auth.userId, 'onboarding.defaults_repaired', 'company', companyId)
  revalidatePath('/onboarding')
  revalidatePath('/dashboard')
  revalidatePath('/settings/industry')
}

export async function completeOnboardingAction() {
  const auth = await requireAuth()
  if (!auth.membership) redirect('/setup')
  if (!canManageOnboarding(auth)) throw new Error('Du saknar behörighet för att slutföra onboarding.')

  const companyId = auth.membership.companyId
  const progress = await getOnboardingProgress(companyId, auth.membership.industryType)

  if (progress.requiredRemaining.length > 0) {
    const missing = progress.requiredRemaining.map((status) => status.step.title).join(', ')
    throw new Error(`Följande steg behöver slutföras först: ${missing}.`)
  }

  const completedSteps = Array.from(
    new Set([
      ...progress.steps.filter((status) => status.done).map((status) => status.step.key),
      ...(progress.session?.completed_steps ?? []),
      'finish',
    ]),
  )

  const { error } = await supabaseAdmin.from('company_onboarding_sessions').upsert({
    company_id: companyId,
    status: 'completed',
    current_step: 'finish',
    completed_steps: completedSteps,
    completed_by: auth.userId,
    completed_at: new Date().toISOString(),
  }, { onConflict: 'company_id' })
  if (error) throw toFriendlyError(error)
  await audit(companyId, auth.userId, 'onboarding.completed', 'company_onboarding_session', companyId)
  redirect('/dashboard')
}

