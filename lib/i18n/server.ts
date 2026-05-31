import { cache } from 'react'

import type { AuthContext } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { defaultRegionalSettings, normalizeLocale, type CompanyRegionalSettings } from './config'
import { createTranslator } from './labels'

type CompanySettingsLocaleRow = {
  locale: string | null
  timezone: string | null
  currency: string | null
  date_format: string | null
  time_format: string | null
}

export const getCompanyRegionalSettings = cache(async (companyId: string | null | undefined): Promise<CompanyRegionalSettings> => {
  if (!companyId) return defaultRegionalSettings

  const { data } = await supabaseAdmin
    .from('company_settings')
    .select('locale, timezone, currency, date_format, time_format')
    .eq('company_id', companyId)
    .maybeSingle()
  const settings = data as CompanySettingsLocaleRow | null

  return {
    locale: normalizeLocale(settings?.locale),
    timezone: settings?.timezone ?? defaultRegionalSettings.timezone,
    currency: settings?.currency ?? defaultRegionalSettings.currency,
    dateFormat: settings?.date_format ?? defaultRegionalSettings.dateFormat,
    timeFormat: settings?.time_format === '12h' ? '12h' : '24h',
  }
})

export async function getAuthTranslator(auth: AuthContext) {
  const settings = await getCompanyRegionalSettings(auth.membership?.companyId)
  return {
    ...settings,
    ...createTranslator(settings.locale),
  }
}

