/**
 * Shared configuration for the public demo form and the admin lead pipeline.
 * Internal codes are stable; labels are customer-facing Swedish.
 */

export const DEMO_NEEDS_OPTIONS = [
  { code: 'staff_planning', label: 'Personalplanering' },
  { code: 'route_planning', label: 'Ruttplanering' },
  { code: 'resource_responsibility', label: 'Resursansvar' },
  { code: 'mobile_execution', label: 'Mobil vy för utförare' },
  { code: 'deviation_management', label: 'Avvikelsehantering' },
  { code: 'case_management', label: 'Ärendehantering' },
  { code: 'project_planning', label: 'Projektplanering' },
  { code: 'reports', label: 'Rapporter och uppföljning' },
  { code: 'smart_replanning', label: 'Smart omplanering' },
  { code: 'industry_onboarding', label: 'Branschanpassad onboarding' },
  { code: 'other', label: 'Annat' },
] as const

export const DEMO_NEED_CODES = new Set(DEMO_NEEDS_OPTIONS.map((option) => option.code as string))

export function demoNeedLabel(code: string) {
  return DEMO_NEEDS_OPTIONS.find((option) => option.code === code)?.label ?? code
}

export const DEMO_STATUS_LABELS: Record<string, string> = {
  new: 'Ny',
  contacted: 'Kontaktad',
  qualified: 'Kvalificerad',
  demo_booked: 'Demo bokad',
  offer_sent: 'Offert skickad',
  pilot_offered: 'Pilot erbjuden',
  pilot_started: 'Pilot startad',
  company_created: 'Bolag skapat',
  onboarding_started: 'Onboarding startad',
  won: 'Vunnen',
  lost: 'Förlorad',
  archived: 'Arkiverad',
}

export const DEMO_STATUS_ORDER = [
  'new',
  'contacted',
  'qualified',
  'demo_booked',
  'offer_sent',
  'pilot_offered',
  'pilot_started',
  'company_created',
  'onboarding_started',
  'won',
  'lost',
  'archived',
] as const

export function demoStatusLabel(status: string) {
  return DEMO_STATUS_LABELS[status] ?? status
}

/** Normalizes Swedish org numbers to NNNNNN-NNNN when possible. */
export function normalizeOrgNumber(input: string | null | undefined): string | null {
  if (!input) return null
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10) return `${digits.slice(0, 6)}-${digits.slice(6)}`
  if (digits.length === 12) return `${digits.slice(2, 8)}-${digits.slice(8)}`
  return input.trim() || null
}

/** Keeps digits, plus sign and spaces from a phone number. */
export function sanitizePhone(input: string | null | undefined): string | null {
  if (!input) return null
  const cleaned = input.replace(/[^\d+\s()-]/g, '').trim().slice(0, 30)
  return cleaned || null
}
