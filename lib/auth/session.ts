import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { CompanyRole, PlatformRole } from '@/lib/auth/permissions'

export type AuthContext = {
  userId: string
  email: string | null
  platformRole: PlatformRole
  membership: {
    membershipId: string
    companyId: string
    companyName: string
    companyRole: CompanyRole
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
    .select('platform_role')
    .eq('id', user.id)
    .maybeSingle()

  const { data: membership } = await supabase
    .from('company_memberships')
    .select('id, company_id, role, is_default, companies(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    userId: user.id,
    email: user.email ?? null,
    platformRole: (profile?.platform_role ?? null) as PlatformRole,
    membership: membership
      ? {
          membershipId: membership.id,
          companyId: membership.company_id,
          companyName: Array.isArray(membership.companies)
            ? membership.companies[0]?.name ?? 'Unknown company'
            : membership.companies?.name ?? 'Unknown company',
          companyRole: membership.role as CompanyRole,
        }
      : null,
  }
}
