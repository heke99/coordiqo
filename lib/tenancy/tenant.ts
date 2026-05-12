import { redirect } from 'next/navigation'

import { requireAuth } from '@/lib/auth/session'

export async function requireActiveCompanyMembership() {
  const auth = await requireAuth()

  if (!auth.membership) {
    redirect('/setup')
  }

  return auth.membership
}
