export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { Field, inputClassName, selectClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { localeLabels, supportedLocales } from '@/lib/i18n/config'
import { createTranslator } from '@/lib/i18n/labels'
import { updateCompanyLocalizationSettingsAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

const settingsSections = [
  {
    href: '/settings/industry',
    title: 'Bransch och operativ modell',
    description: 'Välj primär branschprofil och arbetsmodell. Det styr presets och språk, men låser inte bort resten av systemet.',
    status: 'aktiv',
  },
  {
    href: '/settings/skills',
    title: 'Kompetenser och certifikat',
    description: 'Skapa kompetenser, certifikat och regler som planeringsmotorn använder vid tilldelning.',
    status: 'aktiv',
  },
  {
    href: '/settings/permissions',
    title: 'Behörigheter och RBAC',
    description: 'Hantera permission overrides per company-roll och säkerställ att rätt roll ser rätt ytor.',
    status: 'ny',
  },
  {
    href: '/settings/invitations',
    title: 'Inbjudningar',
    description: 'Skicka invites via email, skicka om länkar och avbryt felaktiga inbjudningar.',
    status: 'ny',
  },
  {
    href: '/settings/health',
    title: 'Systemhälsa',
    description: 'Readiness-check för bransch, presets, email, storage, maps, AI och grunddata.',
    status: 'ny',
  },
  {
    href: '/settings/support',
    title: 'Supportläge',
    description: 'Starta och avsluta audit-loggade supportsessioner med tydlig orsak.',
    status: 'ny',
  },
  {
    href: '/audit',
    title: 'Auditlogg',
    description: 'Spåra ändringar, overrides, invites, supportåtgärder och publiceringar.',
    status: 'ny',
  },
  {
    href: '/notifications',
    title: 'Notiser',
    description: 'Samlad vy för in-app notiser kopplade till drift, invites och bolagsbeslut.',
    status: 'ny',
  },
  {
    href: '/resources',
    title: 'Resurser och ansvar',
    description: 'Administrera fordon, nycklar, verktyg och andra resurser som kan kopplas till uppdrag och personal.',
    status: 'aktiv',
  },
  {
    href: '/teams',
    title: 'Team och organisation',
    description: 'Bygg team, distrikt, patruller och arbetsgrupper som används i planeringen.',
    status: 'aktiv',
  },
]

export default async function SettingsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { t } = createTranslator(auth.membership.locale)
  const { data: companySettings } = await supabaseAdmin
    .from('company_settings')
    .select('locale, timezone, currency, date_format, time_format')
    .eq('company_id', auth.membership.companyId)
    .maybeSingle()
  const settings = companySettings as any

  return (
    <AppShell
      auth={auth}
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
    >
      <div className="space-y-5">
        <section className="coordiqo-card bg-slate-950 p-6 text-white sm:p-7">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-slate-300">{t('settings.systemProfile')}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{auth.membership.companyName}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Företaget kör {auth.membership.industryLabel.toLowerCase()} som primär bransch och {auth.membership.operationalModelLabel.toLowerCase()} som primär arbetsmodell. Det är inte en låsning; alla kärnmoduler kan användas ihop.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <StatusBadge status={auth.membership.industryLabel} />
            <StatusBadge status={auth.membership.operationalModelLabel} />
            <StatusBadge status={`${auth.membership.activeModules.length} moduler`} />
          </div>
        </section>

        <section className="coordiqo-card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-slate-950">{t('settings.languageRegionTitle')}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{t('settings.languageRegionDescription')}</p>
            </div>
            <StatusBadge status={localeLabels[(settings?.locale ?? auth.membership.locale) as keyof typeof localeLabels] ?? auth.membership.locale} />
          </div>
          <form action={updateCompanyLocalizationSettingsAction} className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Field label={t('settings.language')}>
              <select name="locale" defaultValue={settings?.locale ?? auth.membership.locale} className={selectClassName}>
                {supportedLocales.map((locale) => <option key={locale} value={locale}>{localeLabels[locale]}</option>)}
              </select>
            </Field>
            <Field label={t('settings.timezone')}>
              <input name="timezone" defaultValue={settings?.timezone ?? auth.membership.timezone} className={inputClassName} />
            </Field>
            <Field label={t('settings.currency')}>
              <input name="currency" defaultValue={settings?.currency ?? auth.membership.currency} className={inputClassName} />
            </Field>
            <Field label={t('settings.dateFormat')}>
              <input name="date_format" defaultValue={settings?.date_format ?? auth.membership.dateFormat} className={inputClassName} />
            </Field>
            <Field label={t('settings.timeFormat')}>
              <select name="time_format" defaultValue={settings?.time_format ?? auth.membership.timeFormat} className={selectClassName}>
                <option value="24h">24h</option>
                <option value="12h">12h</option>
              </select>
            </Field>
            <div className="md:col-span-2 lg:col-span-5">
              <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">{t('common.save')}</button>
            </div>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {settingsSections.map((section) => (
            <Link key={section.href} href={section.href} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{section.description}</p>
                </div>
                <StatusBadge status={section.status} />
              </div>
            </Link>
          ))}
        </section>

        <EmptyState
          eyebrow="Kommande företagsadmin"
          title="Nästa nivå blir fler företagsinställningar"
          description="Batch 1-ytorna är nu samlade här: behörigheter, inbjudningar, audit, systemhälsa, support och notiser. Nästa steg är att koppla fler integrationer och import/export när plattformen hårdas ytterligare."
        />
      </div>
    </AppShell>
  )
}
