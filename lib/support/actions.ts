'use server'

import { revalidatePath } from 'next/cache'

import { trackProductEvent } from '@/lib/analytics/product-events'
import { requireCompanyContext, requirePlatformAdmin } from '@/lib/auth/guards'
import { getSupportEmail } from '@/lib/config/emails'
import { queueAndSendEmail } from '@/lib/email/outbound'
import { toFriendlyError } from '@/lib/errors/friendly-error'
import { logAuditEvent } from '@/lib/platform/audit'
import { supabaseAdmin } from '@/lib/supabase/admin'

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

const SUPPORT_STATUSES = ['new', 'in_progress', 'waiting_for_customer', 'resolved', 'archived'] as const
const SUPPORT_SEVERITIES = ['low', 'normal', 'high', 'critical'] as const

export async function createSupportRequestAction(formData: FormData) {
  const auth = await requireCompanyContext()
  const subject = value(formData, 'subject')
  const message = value(formData, 'message')
  if (!subject) throw new Error('Ämne krävs.')
  if (!message) throw new Error('Beskriv gärna vad du behöver hjälp med.')
  if (message.length > 4000) throw new Error('Meddelandet är för långt (max 4000 tecken).')

  const severity = SUPPORT_SEVERITIES.find((entry) => entry === value(formData, 'severity')) ?? 'normal'

  const { data, error } = await supabaseAdmin
    .from('support_requests')
    .insert({
      company_id: auth.membership.companyId,
      created_by: auth.userId,
      subject,
      message,
      severity,
      related_url: value(formData, 'related_url'),
      metadata: { companyName: auth.membership.companyName },
    })
    .select('id')
    .single()
  if (error) throw toFriendlyError(error)

  try {
    await queueAndSendEmail({
      companyId: auth.membership.companyId,
      to: getSupportEmail(),
      subject: `Supportärende: ${subject} (${auth.membership.companyName})`,
      bodyText: [
        `Nytt supportärende från ${auth.membership.companyName}`,
        '',
        `Ämne: ${subject}`,
        `Allvarlighetsgrad: ${severity}`,
        `Från: ${auth.email ?? auth.userId}`,
        '',
        message,
      ].join('\n'),
      relatedEntityType: 'support_request',
      relatedEntityId: data.id,
    })
  } catch {
    // Email failure must not block the support request itself.
  }

  await logAuditEvent({
    companyId: auth.membership.companyId,
    actorUserId: auth.userId,
    action: 'support_request.created',
    entityType: 'support_request',
    entityId: data.id,
    metadata: { subject, severity },
  })
  await trackProductEvent('support_request_created', { companyId: auth.membership.companyId, userId: auth.userId })
  revalidatePath('/settings/support')
}

export async function updateSupportRequestAction(formData: FormData) {
  const auth = await requirePlatformAdmin()
  const id = value(formData, 'id')
  if (!id) throw new Error('Supportärende saknas.')

  const status = SUPPORT_STATUSES.find((entry) => entry === value(formData, 'status')) ?? 'new'
  const update: Record<string, unknown> = {
    status,
    assigned_to: value(formData, 'assigned_to'),
    archived_at: status === 'archived' ? new Date().toISOString() : null,
  }

  const { data, error } = await supabaseAdmin
    .from('support_requests')
    .update(update)
    .eq('id', id)
    .select('company_id')
    .single()
  if (error) throw toFriendlyError(error)

  await logAuditEvent({
    companyId: data.company_id,
    actorUserId: auth.userId,
    action: 'support_request.updated',
    entityType: 'support_request',
    entityId: id,
    metadata: { status },
  })
  revalidatePath('/admin/support')
  revalidatePath('/settings/support')
}
