export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import { requireAuth } from '@/lib/auth/session'

export default async function HomePage() {
  const auth = await requireAuth()

  if (!auth.membership) {
    redirect('/setup')
  }

  redirect('/dashboard')
}
