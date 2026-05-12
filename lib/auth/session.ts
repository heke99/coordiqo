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
  activeModules: string[]
  uiLabelSet: string | null
  isDefault: boolean
}

export type AuthContext = {
  userId: string
  email: string | null
  profileName: string | null
  platformRole: PlatformRole
  membership: AuthCompanyMembership | null
  memberships: AuthCompanyMembership[]
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
      .select('platform_role, full_name')
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

  const membershipRows = memberships ?? []
  const companyIds = membershipRows.map((membership) => membership.company_id).filter(Boolean)

  const [{ data: companies }, { data: settingsRows }] = companyIds.length
    ? await Promise.all([
        supabaseAdmin
          .from('companies')
          .select('id, name, slug, status, industry_type, operational_model')
          .in('id', companyIds),
        supabaseAdmin
          .from('company_settings')
          .select('company_id, active_modules, ui_label_set')
          .in('company_id', companyIds),
      ])
    : [{ data: [] }, { data: [] }]

  const companyById = new Map((companies ?? []).map((company: any) => [company.id, company]))
  const settingsByCompanyId = new Map((settingsRows ?? []).map((settings: any) => [settings.company_id, settings]))

  const mappedMemberships = membershipRows
    .map((membershipRecord: any) => {
      const companyRecord = companyById.get(membershipRecord.company_id)
      if (!companyRecord || companyRecord.status !== 'active') return null
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
        activeModules: settingsRecord?.active_modules ?? [],
        uiLabelSet: settingsRecord?.ui_label_set ?? null,
        isDefault: Boolean(membershipRecord.is_default),
      }
    })
    .filter(Boolean) as AuthCompanyMembership[]

  const membershipRecord = membershipRows[0] ?? null
  const companyRecord = membershipRecord ? companyById.get(membershipRecord.company_id) : null

  if (membershipRecord && companyRecord?.status === 'inactive') {
    redirect('/login?error=inactive-company')
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    profileName: profile?.full_name ?? null,
    platformRole: (profile?.platform_role ?? null) as PlatformRole,
    membership: mappedMemberships[0] ?? null,
    memberships: mappedMemberships,
  }
}
