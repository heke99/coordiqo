import { en } from './dictionaries/en'
import { sv } from './dictionaries/sv'
import { defaultLocale, normalizeLocale, type Locale } from './config'

export const dictionaries = {
  sv,
  en,
} as const

export type TranslationKey = keyof typeof sv

type TranslationParams = Record<string, string | number | null | undefined>

function interpolate(value: string, params?: TranslationParams) {
  if (!params) return value
  return value.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
}

export function translate(localeInput: string | null | undefined, key: TranslationKey, params?: TranslationParams) {
  const locale = normalizeLocale(localeInput)
  const dictionary = dictionaries[locale]
  const fallbackDictionary = dictionaries[defaultLocale]
  const value = dictionary[key] ?? fallbackDictionary[key] ?? key
  return interpolate(value, params)
}

export function createTranslator(localeInput: string | null | undefined) {
  const locale = normalizeLocale(localeInput)
  return {
    locale,
    t: (key: TranslationKey, params?: TranslationParams) => translate(locale, key, params),
  }
}

export const statusLabelKeys = {
  ready: 'common.ready',
  needs_action: 'common.needsAction',
  blocked: 'common.blocked',
  can_be_planned: 'common.canBePlanned',
  override_required: 'common.overrideRequired',
  ready_for_publishing: 'common.readyForPublishing',
  post_calculation_required: 'common.postCalculationRequired',
  active: 'common.active',
  planned: 'common.planned',
  done: 'common.done',
  missing: 'common.missing',
} as const satisfies Record<string, TranslationKey>

export function localizedStatusLabel(locale: Locale | string | null | undefined, status: string | null | undefined) {
  if (!status) return ''
  const key = statusLabelKeys[status as keyof typeof statusLabelKeys]
  return key ? translate(locale, key) : status.replace(/_/g, ' ')
}

