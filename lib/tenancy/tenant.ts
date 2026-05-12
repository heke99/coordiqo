import { redirect } from 'next/navigation'

import { requireAuth } from '@/lib/auth/session'

export async function requireActiveCompanyMembership() {
  const auth = await requireAuth()

  if (!auth.membership) {
    redirect('/login?error=no-membership')
  }

  return auth.membership
}
