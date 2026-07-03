'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { trackProductEvent } from '@/lib/analytics/product-events'
import { isPlatformAdminRole, type CompanyRole } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { getSalesEmail } from '@/lib/config/emails'
import { queueAndSendEmail } from '@/lib/email/outbound'
import { demoRequestReceivedEmail, firstAdminInviteEmail, internalNewLeadEmail } from '@/lib/email/templates'
import { friendlyErrorMessage, toFriendlyError } from '@/lib/errors/friendly-error'
import { allCompanyCoreModules } from '@/lib/industry/config'
import { getActiveIndustryProfiles, getIndustryProfile } from '@/lib/industry/registry'
import { getOnboardingProgress } from '@/lib/onboarding/progress'
import { logAuditEvent } from '@/lib/platform/audit'
import { DEMO_NEED_CODES, DEMO_STATUS_LABELS, demoNeedLabel, normalizeOrgNumber, sanitizePhone } from '@/lib/sales/demo-config'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_MESSAGE_LENGTH = 4000

export async function submitDemoRequestAction(formData: FormData) {
  // Honeypot: bots fill hidden fields. Pretend success without saving.
  if (value(formData, 'website') || value(formData, 'company_website')) {
    redirect('/book-demo?success=1')
  }

  const companyName = value(formData, 'company_name')?.slice(0, 200)
  const contactName = value(formData, 'contact_name')?.slice(0, 200)
  const email = value(formData, 'email')?.toLowerCase().slice(0, 320)
  const consent = formData.get('consent') === 'on'
  const message = value(formData, 'message')

  const fail = (errorMessage: string): never => {
    redirect(`/book-demo?error=${encodeURIComponent(errorMessage)}`)
  }

  if (!companyName) fail('Företagsnamn krävs.')
  if (!contactName) fail('Kontaktperson krävs.')
  if (!email || !EMAIL_PATTERN.test(email)) fail('Ange en giltig e-postadress.')
  if (!consent) fail('Du behöver godkänna att vi kontaktar dig om demo.')
  if (message && message.length > MAX_MESSAGE_LENGTH) fail('Meddelandet är för långt (max 4000 tecken).')

  // Only accept industries that exist in the registry; unknown values fall
  // back to "other" so the form never breaks when industries change.
  const activeIndustries = await getActiveIndustryProfiles()
  const requestedIndustry = value(formData, 'industry')
  const industry = activeIndustries.some((profile) => profile.code === requestedIndustry) ? requestedIndustry : 'other'

  const needs = values(formData, 'needs').filter((need) => DEMO_NEED_CODES.has(need)).slice(0, 20)

  const payload = {
    company_name: companyName,
    organization_number: normalizeOrgNumber(value(formData, 'organization_number')),
    contact_name: contactName,
    email,
    phone: sanitizePhone(value(formData, 'phone')),
    industry,
    employee_count: value(formData, 'employee_count')?.slice(0, 20) ?? null,
    weekly_jobs_count: value(formData, 'weekly_jobs_count')?.slice(0, 20) ?? null,
    needs,
    preferred_language: normalizeLocale(value(formData, 'preferred_language')),
    message: message?.slice(0, MAX_MESSAGE_LENGTH) ?? null,
    status: 'new',
    source: 'website',
  }

  const { data, error } = await supabaseAdmin.from('demo_requests').insert(payload).select('id').single()
  if (error) {
    fail(friendlyErrorMessage(error, 'Din ansökan kunde inte skickas just nu. Försök igen om en stund.'))
    return
  }

  try {
    const industryLabel = activeIndustries.find((profile) => profile.code === industry)?.nameSv ?? industry
    const internalEmail = internalNewLeadEmail({
      companyName: payload.company_name!,
      orgNumber: payload.organization_number,
      contactName: payload.contact_name!,
      email: payload.email!,
      phone: payload.phone,
      industryLabel,
      employeeCount: payload.employee_count,
      weeklyJobs: payload.weekly_jobs_count,
      needs: needs.map((need) => demoNeedLabel(need)),
      language: payload.preferred_language,
      message: payload.message,
    })

    await queueAndSendEmail({
      companyId: null,
      to: getSalesEmail(),
      subject: internalEmail.subject,
      bodyText: internalEmail.bodyText,
      relatedEntityType: 'demo_request',
      relatedEntityId: data.id,
    })

    if (process.env.RESEND_API_KEY) {
      const confirmation = demoRequestReceivedEmail({ contactName: payload.contact_name!, language: payload.preferred_language })
      await queueAndSendEmail({
        companyId: null,
        to: payload.email!,
        subject: confirmation.subject,
        bodyText: confirmation.bodyText,
        relatedEntityType: 'demo_request',
        relatedEntityId: data.id,
      })
    }
  } catch (emailError) {
    await audit(null, null, 'demo_request.email_failed', 'demo_request', data.id, {
      message: emailError instanceof Error ? emailError.message : 'unknown_email_error',
    })
  }

  await trackProductEvent('demo_submitted', { metadata: { industry: industry ?? 'other' } })
  redirect('/book-demo?success=1')
}

export async function updateDemoRequestAction(formData: FormData) {
  const auth = await requirePlatformAdmin('att hantera demoansökningar')
  const id = value(formData, 'id')
  if (!id) throw new Error('Demoansökan saknas.')

  const requestedStatus = value(formData, 'status') ?? 'new'
  if (!DEMO_STATUS_LABELS[requestedStatus]) throw new Error('Ogiltig status för demoansökan.')

  const lostReason = value(formData, 'lost_reason')
  if (requestedStatus === 'lost' && !lostReason) {
    throw new Error('Ange en orsak när en lead markeras som förlorad.')
  }

  const update: Record<string, unknown> = {
    status: requestedStatus,
    assigned_to: value(formData, 'assigned_to'),
    next_contact_at: value(formData, 'next_contact_at') ? new Date(value(formData, 'next_contact_at')!).toISOString() : null,
    lost_reason: requestedStatus === 'lost' ? lostReason : null,
    archived_at: requestedStatus === 'archived' ? new Date().toISOString() : null,
  }

  const { error } = await supabaseAdmin.from('demo_requests').update(update).eq('id', id)
  if (error) throw toFriendlyError(error)
  await audit(null, auth.userId, 'demo_request.updated', 'demo_request', id, { status: requestedStatus, lostReason })
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

  // Normalized Swedish org number duplicate check.
  const orgNumber = normalizeOrgNumber(request.organization_number)
  if (orgNumber) {
    const digits = orgNumber.replace(/\D/g, '')
    const { data: allOrgCompanies } = await supabaseAdmin.from('companies').select('id, org_number').not('org_number', 'is', null)
    const duplicate = (allOrgCompanies ?? []).find((company) => (company.org_number ?? '').replace(/\D/g, '') === digits)
    if (duplicate) throw new Error('Ett bolag med detta organisationsnummer finns redan.')
  }

  // Slug uniqueness with bounded retry.
  const slugBase = normalizeSlug(request.company_name)
  let slug = slugBase
  for (let suffix = 1; suffix <= 50; suffix += 1) {
    const { data: existingSlug } = await supabaseAdmin.from('companies').select('id').eq('slug', slug).maybeSingle()
    if (!existingSlug) break
    slug = `${slugBase}-${suffix}`
  }

  // Industry validated against the registry; unknown codes fall back to 'other'.
  const profile = await getIndustryProfile(request.industry)
  const industryType = profile.code
  const operationalModel = profile.defaultOperationalModel
  const locale = normalizeLocale(request.preferred_language)

  const { data: company, error: companyError } = await supabaseAdmin.from('companies').insert({
    name: request.company_name,
    slug,
    org_number: orgNumber,
    status: 'active',
    lifecycle_status: 'active',
    industry_type: industryType,
    operational_model: operationalModel,
    language_code: locale,
    timezone: profile.defaultTimezone,
    contract_status: 'pilot',
    approved_by: auth.userId,
    approved_at: new Date().toISOString(),
  }).select('id').single()
  if (companyError) throw toFriendlyError(companyError)

  // Everything below is idempotent (upserts + registry-driven defaults). If a
  // step fails, the admin can re-run "Reparera standarder" on the company page.
  try {
    const activeModules = allCompanyCoreModules()
    await supabaseAdmin.from('company_settings').upsert({
      company_id: company.id,
      active_modules: activeModules,
      ui_label_set: industryType,
      locale,
      timezone: profile.defaultTimezone,
      currency: profile.defaultCurrency,
    }, { onConflict: 'company_id' })

    await supabaseAdmin.from('industry_runtime_configs').upsert({
      company_id: company.id,
      industry_code: industryType,
      operational_model: operationalModel,
      terminology: profile.terminology,
      task_statuses: profile.statuses,
      mobile_actions: profile.mobileActions,
      planning_rules: profile.planningRules,
      settings: {
        primaryOperationalModel: operationalModel,
        enabledOperationalModels: Array.from(new Set([operationalModel, ...profile.allowedOperationalModels])),
        allCoreModulesEnabled: true,
        note: 'Industry model prepares editable defaults only. It does not lock modules, templates, labels or workflows.',
      },
      updated_by: auth.userId,
    }, { onConflict: 'company_id' })

    await supabaseAdmin.rpc('ensure_company_industry_defaults', { target_company_id: company.id }).throwOnError()

    await supabaseAdmin.from('company_onboarding_sessions').upsert({
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
    }, { onConflict: 'company_id' })

    // First team, created idempotently.
    const { data: existingTeam } = await supabaseAdmin.from('teams').select('id').eq('company_id', company.id).limit(1).maybeSingle()
    if (!existingTeam) {
      await supabaseAdmin.from('teams').insert({ company_id: company.id, name: 'Huvudteam', code: 'MAIN', status: 'active' })
    }
  } catch (setupError) {
    // The company exists; record the partial failure so admin sees the repair option.
    await audit(company.id, auth.userId, 'demo_request.company_setup_incomplete', 'company', company.id, {
      requestId: request.id,
      message: setupError instanceof Error ? setupError.message : 'unknown',
    })
    await supabaseAdmin.from('demo_requests').update({ created_company_id: company.id, status: 'company_created' }).eq('id', request.id)
    throw new Error('Bolaget skapades men delar av standardinnehållet saknas. Öppna bolaget och kör "Reparera standarder".')
  }

  await supabaseAdmin.from('demo_requests').update({ created_company_id: company.id, status: 'company_created' }).eq('id', request.id)
  await audit(company.id, auth.userId, 'demo_request.company_created', 'demo_request', request.id, { requestId: request.id, companyId: company.id, industryType, operationalModel, actor: auth.userId })
  await trackProductEvent('company_created_from_demo', { companyId: company.id, userId: auth.userId })
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

  const { data: request } = await supabaseAdmin.from('demo_requests').select('id, created_company_id, company_name').eq('id', requestId).maybeSingle()
  if (!request || request.created_company_id !== companyId) throw new Error('Bolaget matchar inte demoansökan.')

  // Existing users are added safely as members instead of failing.
  const { data: existingProfile } = await supabaseAdmin.from('profiles').select('id').ilike('email', email!).maybeSingle()

  let userId = existingProfile?.id ?? null
  let createdNewUser = false

  if (!userId) {
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { created_by: 'coordiqo_superadmin', must_change_password: true },
    })
    if (createError) {
      throw new Error(createError.message.includes('already') ? 'En användare med denna e-post finns redan.' : friendlyErrorMessage(createError, 'Användaren kunde inte skapas just nu. Försök igen.'))
    }
    userId = createdUser.user?.id ?? null
    createdNewUser = true
  }
  if (!userId) throw new Error('Användaren kunde inte skapas just nu. Försök igen.')

  const now = new Date().toISOString()
  await supabaseAdmin.from('profiles').upsert({
    id: userId,
    email,
    full_name: fullName,
    preferred_locale: preferredLocale,
    ...(createdNewUser
      ? { must_change_password: true, created_by_superadmin: auth.userId, temporary_access_created_at: now }
      : {}),
  })

  // Duplicate memberships are prevented by the unique upsert key.
  await supabaseAdmin.from('company_memberships').upsert({
    company_id: companyId,
    user_id: userId,
    role,
    status: 'active',
    is_default: true,
    invited_by: auth.userId,
  }, { onConflict: 'company_id,user_id' })

  // Welcome email is best-effort: failure never blocks admin creation.
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
    const invite = firstAdminInviteEmail({ companyName: request.company_name ?? 'ert bolag', fullName: fullName!, loginUrl: `${siteUrl}/login` })
    await queueAndSendEmail({
      companyId,
      to: email!,
      subject: invite.subject,
      bodyText: invite.bodyText,
      relatedEntityType: 'company_membership',
      relatedEntityId: companyId,
    })
  } catch (emailError) {
    await audit(companyId, auth.userId, 'company_admin.invite_email_failed', 'profile', userId, {
      message: emailError instanceof Error ? emailError.message : 'unknown_email_error',
    })
  }

  await audit(companyId, auth.userId, createdNewUser ? 'company_admin.temporary_user_created' : 'company_admin.existing_user_added', 'profile', userId, { requestId, email, role })
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

  if (!session || session.status === 'not_started') {
    await trackProductEvent('onboarding_started', { companyId, userId: auth.userId })
  }

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
  await trackProductEvent('onboarding_completed', { companyId, userId: auth.userId })
  redirect('/dashboard')
}

