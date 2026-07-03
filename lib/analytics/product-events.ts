import { supabaseAdmin } from '@/lib/supabase/admin'

export type ProductEventKey =
  | 'homepage_viewed'
  | 'demo_page_viewed'
  | 'demo_submitted'
  | 'login_succeeded'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'first_task_created'
  | 'first_planning_run_created'
  | 'first_assignment_published'
  | 'support_request_created'
  | 'company_created_from_demo'
  | 'demo_company_created'

/**
 * Records a lightweight internal product event. Never throws and never blocks
 * the calling action. Do not put sensitive free text in metadata.
 */
export async function trackProductEvent(
  eventKey: ProductEventKey,
  options: { companyId?: string | null; userId?: string | null; metadata?: Record<string, string | number | boolean | null> } = {},
) {
  try {
    await supabaseAdmin.from('product_events').insert({
      event_key: eventKey,
      company_id: options.companyId ?? null,
      user_id: options.userId ?? null,
      metadata: options.metadata ?? {},
    })
  } catch {
    // Analytics must never break business flows.
  }
}

/**
 * Tracks an event only the first time it happens for a company
 * (e.g. first task created, first planning run).
 */
export async function trackFirstProductEvent(
  eventKey: ProductEventKey,
  companyId: string,
  userId?: string | null,
) {
  try {
    const { count } = await supabaseAdmin
      .from('product_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_key', eventKey)
      .eq('company_id', companyId)

    if (Number(count ?? 0) === 0) {
      await trackProductEvent(eventKey, { companyId, userId })
    }
  } catch {
    // Analytics must never break business flows.
  }
}
