import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { CompanyRole, PlatformRole } from '@/lib/auth/permissions'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('platform_role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  let membershipRecord: {
    id: string
    company_id: string
    role: string
    is_default: boolean
  } | null = null

  let companyRecord: {
    name: string
    slug: string | null
    status: string
  } | null = null

  const primaryMembershipResult = await supabase
    .from('company_memberships')
    .select('id, company_id, role, is_default')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('is_default', true)
    .limit(1)
    .maybeSingle()

  if (primaryMembershipResult.data) {
    membershipRecord = primaryMembershipResult.data
  } else {
    const fallbackMembershipResult = await supabase
      .from('company_memberships')
      .select('id, company_id, role, is_default')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    membershipRecord = fallbackMembershipResult.data
  }

  if (membershipRecord) {
    const { data: company } = await supabase
      .from('companies')
      .select('name, slug, status')
      .eq('id', membershipRecord.company_id)
      .maybeSingle()

    companyRecord = company
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
          }
        : null,
  }
}
