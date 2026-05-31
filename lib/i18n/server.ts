import { cache } from 'react'

import type { AuthContext } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { defaultRegionalSettings, normalizeLocale, type CompanyRegionalSettings } from './config'
import { createTranslator } from './labels'

export const getCompanyRegionalSettings = cache(async (companyId: string | null | undefined): Promise<CompanyRegionalSettings> => {
  if (!companyId) return defaultRegionalSettings

  const { data } = await supabaseAdmin
    .from('company_settings')
    .select('locale, timezone, currency, date_format, time_format')
    .eq('company_id', companyId)
    .maybeSingle()

  return {
    locale: normalizeLocale((data as any)?.locale),
    timezone: (data as any)?.timezone ?? defaultRegionalSettings.timezone,
    currency: (data as any)?.currency ?? defaultRegionalSettings.currency,
    dateFormat: (data as any)?.date_format ?? defaultRegionalSettings.dateFormat,
    timeFormat: ((data as any)?.time_format === '12h' ? '12h' : '24h'),
  }
})

export async function getAuthTranslator(auth: AuthContext) {
  const settings = await getCompanyRegionalSettings(auth.membership?.companyId)
  return {
    ...settings,
    ...createTranslator(settings.locale),
  }
}

