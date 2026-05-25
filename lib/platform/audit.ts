import { supabaseAdmin } from '@/lib/supabase/admin'

export type AuditSource = 'manual' | 'system' | 'ai' | 'sms' | 'email' | 'integration' | 'support'

export type AuditEventInput = {
  companyId: string | null
  actorUserId: string | null
  action: string
  entityType: string
  entityId?: string | null
  entityDisplayName?: string | null
  actorRole?: string | null
  source?: AuditSource
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
  requestId?: string | null
}

function stripUndefined(value: Record<string, unknown> | null | undefined) {
  if (!value) return null
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => typeof entryValue !== 'undefined'))
}

export async function logAuditEvent(input: AuditEventInput) {
  const metadata = stripUndefined({
    ...(input.metadata ?? {}),
    source: input.source ?? input.metadata?.source ?? 'manual',
    actorRole: input.actorRole ?? input.metadata?.actorRole ?? null,
    entityDisplayName: input.entityDisplayName ?? input.metadata?.entityDisplayName ?? null,
    before: stripUndefined(input.before),
    after: stripUndefined(input.after),
    requestId: input.requestId ?? input.metadata?.requestId ?? null,
  }) ?? {}

  const payload: Record<string, unknown> = {
    company_id: input.companyId,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata,
  }

  const { error } = await supabaseAdmin.from('audit_logs').insert(payload)
  if (error) {
    console.error('Audit log failed', {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      message: error.message,
    })
  }
}

export function auditDiff(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) {
  const cleanBefore = stripUndefined(before) ?? {}
  const cleanAfter = stripUndefined(after) ?? {}
  const keys = new Set([...Object.keys(cleanBefore), ...Object.keys(cleanAfter)])
  const changed: Record<string, { before: unknown; after: unknown }> = {}

  for (const key of keys) {
    const beforeValue = cleanBefore[key]
    const afterValue = cleanAfter[key]
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changed[key] = { before: beforeValue ?? null, after: afterValue ?? null }
    }
  }

  return changed
}
