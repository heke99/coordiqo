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

  const { data: membership } = await supabase
    .from('company_memberships')
    .select('id, company_id, role, is_default, companies(name, slug, status)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle()

  const company = Array.isArray(membership?.companies) ? membership?.companies[0] : membership?.companies

  if (membership && company?.status === 'inactive') {
    redirect('/login?error=inactive-company')
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    profileName: profile?.full_name ?? null,
    platformRole: (profile?.platform_role ?? null) as PlatformRole,
    membership: membership
      ? {
          membershipId: membership.id,
          companyId: membership.company_id,
          companyName: company?.name ?? 'Unknown company',
          companySlug: company?.slug ?? null,
          companyRole: membership.role as CompanyRole,
        }
      : null,
  }
}
