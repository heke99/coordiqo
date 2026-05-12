import { supabaseAdmin } from '@/lib/supabase/admin'

type SendEmailInput = {
  companyId: string
  to: string
  subject: string
  bodyText: string
  relatedEntityType?: string
  relatedEntityId?: string
  createdBy?: string
}

export async function queueAndSendEmail(input: SendEmailInput) {
  const { data: email, error } = await supabaseAdmin
    .from('outbound_emails')
    .insert({
      company_id: input.companyId,
      to_email: input.to,
      subject: input.subject,
      body_text: input.bodyText,
      related_entity_type: input.relatedEntityType,
      related_entity_id: input.relatedEntityId,
      created_by: input.createdBy,
      status: 'queued',
      provider: process.env.RESEND_API_KEY ? 'resend' : 'manual_queue',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  if (!process.env.RESEND_API_KEY) {
    await supabaseAdmin
      .from('outbound_emails')
      .update({ status: 'queued', provider: 'manual_queue' })
      .eq('id', email.id)

    return { status: 'queued' as const, emailId: email.id }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.INVITE_EMAIL_FROM ?? 'Coordiqo <noreply@coordiqo.se>',
        to: [input.to],
        subject: input.subject,
        text: input.bodyText,
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message = typeof payload?.message === 'string' ? payload.message : `Resend svarade ${response.status}`
      await supabaseAdmin
        .from('outbound_emails')
        .update({ status: 'failed', error_message: message })
        .eq('id', email.id)
      return { status: 'failed' as const, emailId: email.id, error: message }
    }

    await supabaseAdmin
      .from('outbound_emails')
      .update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: payload?.id ?? null })
      .eq('id', email.id)

    return { status: 'sent' as const, emailId: email.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Okänt e-postfel'
    await supabaseAdmin
      .from('outbound_emails')
      .update({ status: 'failed', error_message: message })
      .eq('id', email.id)
    return { status: 'failed' as const, emailId: email.id, error: message }
  }
}
