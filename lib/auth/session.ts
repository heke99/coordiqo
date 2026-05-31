import { redirect } from 'next/navigation'

import { getIndustryLabel, getOperationalModelLabel } from '@/lib/industry/config'
import type { CompanyRole, PlatformRole } from '@/lib/auth/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type AuthCompanyMembership = {
  membershipId: string
  companyId: string
  companyName: string
  companyRole: CompanyRole
  companySlug: string | null
  industryType: string | null
  industryLabel: string
  operationalModel: string | null
  operationalModelLabel: string
  lifecycleStatus: string | null
  activeModules: string[]
  uiLabelSet: string | null
  locale: string
  timezone: string
  currency: string
  dateFormat: string
  timeFormat: string
  isDefault: boolean
}

export type AuthContext = {
  userId: string
  email: string | null
  profileName: string | null
  platformRole: PlatformRole
  mustChangePassword: boolean
  membership: AuthCompanyMembership | null
  memberships: AuthCompanyMembership[]
}

type MembershipRow = {
  id: string
  company_id: string
  role: string
  is_default: boolean
  created_at: string
}

type CompanyRow = {
  id: string
  name: string | null
  slug: string | null
  status: string
  lifecycle_status?: string | null
  industry_type: string | null
  operational_model: string | null
  language_code?: string | null
}

type CompanySettingsRow = {
  company_id: string
  active_modules: string[] | null
  ui_label_set: string | null
  locale?: string | null
  timezone?: string | null
  currency?: string | null
  date_format?: string | null
  time_format?: string | null
}

export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('platform_role, full_name, must_change_password')
      .eq('id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('company_memberships')
      .select('id, company_id, role, is_default, created_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('archived_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  const membershipRows = (memberships ?? []) as MembershipRow[]
  const companyIds = membershipRows.map((membership) => membership.company_id).filter(Boolean)

  const [{ data: companies }, { data: settingsRows }] = companyIds.length
    ? await Promise.all([
        supabaseAdmin
          .from('companies')
          .select('id, name, slug, status, lifecycle_status, industry_type, operational_model, language_code')
          .in('id', companyIds),
        supabaseAdmin
          .from('company_settings')
          .select('company_id, active_modules, ui_label_set, locale, timezone, currency, date_format, time_format')
          .in('company_id', companyIds),
      ])
    : [{ data: [] }, { data: [] }]

  const companyById = new Map(((companies ?? []) as CompanyRow[]).map((company) => [company.id, company]))
  const settingsByCompanyId = new Map(((settingsRows ?? []) as CompanySettingsRow[]).map((settings) => [settings.company_id, settings]))

  const mappedMemberships = membershipRows
    .map((membershipRecord) => {
      const companyRecord = companyById.get(membershipRecord.company_id)
      if (!companyRecord || companyRecord.status !== 'active') return null
      if ((companyRecord.lifecycle_status ?? 'active') !== 'active') return null
      const settingsRecord = settingsByCompanyId.get(membershipRecord.company_id)

      return {
        membershipId: membershipRecord.id,
        companyId: membershipRecord.company_id,
        companyName: companyRecord.name ?? 'Unknown company',
        companySlug: companyRecord.slug ?? null,
        companyRole: membershipRecord.role as CompanyRole,
        industryType: companyRecord.industry_type ?? null,
        industryLabel: getIndustryLabel(companyRecord.industry_type),
        operationalModel: companyRecord.operational_model ?? null,
        operationalModelLabel: getOperationalModelLabel(companyRecord.operational_model),
        lifecycleStatus: companyRecord.lifecycle_status ?? null,
        activeModules: settingsRecord?.active_modules ?? [],
        uiLabelSet: settingsRecord?.ui_label_set ?? null,
        locale: settingsRecord?.locale ?? companyRecord.language_code ?? 'sv',
        timezone: settingsRecord?.timezone ?? 'Europe/Stockholm',
        currency: settingsRecord?.currency ?? 'SEK',
        dateFormat: settingsRecord?.date_format ?? 'yyyy-MM-dd',
        timeFormat: settingsRecord?.time_format ?? '24h',
        isDefault: Boolean(membershipRecord.is_default),
      }
    })
    .filter(Boolean) as AuthCompanyMembership[]

  const membershipRecord = membershipRows[0] ?? null
  const companyRecord = membershipRecord ? companyById.get(membershipRecord.company_id) : null

  if (membershipRecord && companyRecord?.status === 'inactive') {
    redirect('/login?error=inactive-company')
  }

  if (membershipRecord && companyRecord && (companyRecord.lifecycle_status ?? 'active') !== 'active') {
    redirect('/login?error=company-not-active')
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    profileName: profile?.full_name ?? null,
    platformRole: (profile?.platform_role ?? null) as PlatformRole,
    mustChangePassword: Boolean(profile?.must_change_password),
    membership: mappedMemberships[0] ?? null,
    memberships: mappedMemberships,
  }
}
