import { redirect } from 'next/navigation'

import { getIndustryLabel, getOperationalModelLabel } from '@/lib/industry/config'
import type { CompanyRole, PlatformRole } from '@/lib/auth/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type AuthContext = {
  userId: string
  email: string | null
  profileName: string | null
  platformRole: PlatformRole
  membership: {
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
  } | null
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
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(5),
  ])

  const membershipRecord = memberships?.[0] ?? null

  let companyRecord: {
    name: string | null
    slug: string | null
    status: string | null
    industry_type: string | null
    operational_model: string | null
  } | null = null

  let settingsRecord: {
    active_modules: string[] | null
    ui_label_set: string | null
  } | null = null

  if (membershipRecord?.company_id) {
    const [{ data: company }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from('companies')
        .select('name, slug, status, industry_type, operational_model')
        .eq('id', membershipRecord.company_id)
        .maybeSingle(),
      supabaseAdmin
        .from('company_settings')
        .select('active_modules, ui_label_set')
        .eq('company_id', membershipRecord.company_id)
        .maybeSingle(),
    ])

    companyRecord = company
    settingsRecord = settings
  }

  if (membershipRecord && companyRecord?.status === 'inactive') {
    redirect('/login?error=inactive-company')
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    profileName: profile?.full_name ?? null,
    platformRole: (profile?.platform_role ?? null) as PlatformRole,
    membership:
      membershipRecord && companyRecord
        ? {
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
          }
        : null,
  }
}
