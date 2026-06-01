import { NextResponse, type NextRequest } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const from = String(form.get('From') ?? '').trim()
  const to = String(form.get('To') ?? '').trim()
  const body = String(form.get('Body') ?? '').trim()
  const messageSid = String(form.get('MessageSid') ?? '').trim()
  const companyId = request.nextUrl.searchParams.get('company_id')

  if (!companyId || !from || !body) {
    return new NextResponse('<Response></Response>', { headers: { 'content-type': 'text/xml' }, status: 200 })
  }

  const { data: existingThread } = await supabaseAdmin
    .from('message_threads')
    .select('id')
    .eq('company_id', companyId)
    .eq('channel_type', 'sms')
    .eq('customer_label', from)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const thread = existingThread ?? (await supabaseAdmin.from('message_threads').insert({
    company_id: companyId,
    channel_type: 'sms',
    subject: `SMS från ${from}`,
    customer_label: from,
    status: 'open',
  }).select('id').single()).data

  if (thread?.id) {
    const { data: message } = await supabaseAdmin.from('external_messages').insert({
      company_id: companyId,
      message_thread_id: thread.id,
      direction: 'inbound',
      channel_type: 'sms',
      from_address: from,
      to_address: to,
      body,
      status: 'received',
      provider_message_id: messageSid || null,
      metadata: { provider: 'twilio' },
    }).select('id').single()

    if (message?.id) {
      await supabaseAdmin.from('customer_communication_logs').insert({
        company_id: companyId,
        message_thread_id: thread.id,
        external_message_id: message.id,
        communication_type: 'inbound_sms',
        summary: body.slice(0, 240),
      })
    }
  }

  return new NextResponse('<Response></Response>', { headers: { 'content-type': 'text/xml' }, status: 200 })
}

