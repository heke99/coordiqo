'use server'

import { redirect } from 'next/navigation'

import { requireAuth } from '@/lib/auth/session'
import { logAuditEvent } from '@/lib/platform/audit'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function markPasswordChangedAction() {
  const auth = await requireAuth()
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      must_change_password: false,
      password_changed_at: new Date().toISOString(),
    })
    .eq('id', auth.userId)
  if (error) throw new Error(error.message)

  await logAuditEvent({
    companyId: auth.membership?.companyId ?? null,
    actorUserId: auth.userId,
    action: 'auth.password_changed',
    entityType: 'profile',
    entityId: auth.userId,
    metadata: { source: 'first_login_password_change' },
  })
}

export async function redirectAfterPasswordChangeAction() {
  const auth = await requireAuth()
  if (!auth.membership) redirect('/login')

  const { data: session } = await supabaseAdmin
    .from('company_onboarding_sessions')
    .select('status')
    .eq('company_id', auth.membership.companyId)
    .maybeSingle()

  if (session?.status === 'completed') redirect('/dashboard')
  redirect('/onboarding')
}

