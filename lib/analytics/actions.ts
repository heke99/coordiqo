'use server'

import { trackProductEvent } from '@/lib/analytics/product-events'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Called from the login form after a successful sign-in.
 * Fire-and-forget; never surfaces errors to the user.
 */
export async function trackLoginEventAction() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: membership } = await supabaseAdmin
      .from('company_memberships')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('archived_at', null)
      .limit(1)
      .maybeSingle()

    await trackProductEvent('login_succeeded', { companyId: membership?.company_id ?? null, userId: user.id })
  } catch {
    // Analytics must never break login.
  }
}
