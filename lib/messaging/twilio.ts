export type SendSmsInput = {
  to: string
  body: string
}

export async function sendSmsWithTwilio(input: SendSmsInput) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !from) {
    return { status: 'queued' as const, provider: 'manual_queue', detail: 'SMS är inte konfigurerat.' }
  }

  try {
    const body = new URLSearchParams({
      To: input.to,
      From: from,
      Body: input.body,
    })
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        status: 'failed' as const,
        provider: 'twilio',
        detail: typeof payload?.message === 'string' ? payload.message : `SMS-tjänsten svarade ${response.status}`,
        providerMessageId: null,
        providerResponse: payload,
      }
    }
    return {
      status: 'sent' as const,
      provider: 'twilio',
      detail: 'SMS skickat.',
      providerMessageId: typeof payload?.sid === 'string' ? payload.sid : null,
      providerResponse: payload,
    }
  } catch (error) {
    return {
      status: 'failed' as const,
      provider: 'twilio',
      detail: error instanceof Error ? error.message : 'SMS kunde inte skickas.',
      providerMessageId: null,
      providerResponse: {},
    }
  }
}

