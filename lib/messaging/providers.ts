export type MessagingProviderConfig = {
  resendApiKey: string | null
  twilioAccountSid: string | null
  twilioAuthToken: string | null
  twilioFromNumber: string | null
}

export function getMessagingProviderConfig(): MessagingProviderConfig {
  return {
    resendApiKey: process.env.RESEND_API_KEY ?? null,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? null,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? null,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? null,
  }
}

export function messagingReadiness() {
  const config = getMessagingProviderConfig()
  return {
    emailReady: Boolean(config.resendApiKey),
    smsReady: Boolean(config.twilioAccountSid && config.twilioAuthToken && config.twilioFromNumber),
  }
}

