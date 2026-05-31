export const supportedLocales = ['sv', 'en'] as const

export type Locale = (typeof supportedLocales)[number]

export const defaultLocale: Locale = 'sv'

export const localeLabels: Record<Locale, string> = {
  sv: 'Svenska',
  en: 'English',
}

export function isLocale(value: string | null | undefined): value is Locale {
  return supportedLocales.includes(value as Locale)
}

export function normalizeLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : defaultLocale
}

export type CompanyRegionalSettings = {
  locale: Locale
  timezone: string
  currency: string
  dateFormat: string
  timeFormat: '24h' | '12h'
}

export const defaultRegionalSettings: CompanyRegionalSettings = {
  locale: defaultLocale,
  timezone: 'Europe/Stockholm',
  currency: 'SEK',
  dateFormat: 'yyyy-MM-dd',
  timeFormat: '24h',
}

