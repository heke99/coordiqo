/**
 * Central place for configurable company/contact email addresses.
 * All addresses can be overridden with environment variables; the hardcoded
 * fallback exists only so nothing crashes in unconfigured environments.
 */

const FINAL_FALLBACK_EMAIL = 'support@coordiqo.se'

export function getSalesEmail() {
  return process.env.COORDIQO_SALES_EMAIL || process.env.COORDIQO_SUPPORT_EMAIL || FINAL_FALLBACK_EMAIL
}

export function getSupportEmail() {
  return process.env.COORDIQO_SUPPORT_EMAIL || FINAL_FALLBACK_EMAIL
}

export function getLegalEmail() {
  return process.env.COORDIQO_LEGAL_EMAIL || process.env.COORDIQO_SUPPORT_EMAIL || FINAL_FALLBACK_EMAIL
}

export function getFromEmail() {
  return process.env.COORDIQO_FROM_EMAIL || process.env.INVITE_EMAIL_FROM || 'Coordiqo <noreply@coordiqo.se>'
}

export function getCompanyName() {
  return process.env.NEXT_PUBLIC_COMPANY_NAME || 'Coordiqo'
}

export function getMarketingSiteUrl() {
  return process.env.NEXT_PUBLIC_MARKETING_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || ''
}

export function isEmailSendingConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}
