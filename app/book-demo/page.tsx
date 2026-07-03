import Link from 'next/link'

import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { trackProductEvent } from '@/lib/analytics/product-events'
import { getActiveIndustryProfiles } from '@/lib/industry/registry'
import { submitDemoRequestAction } from '@/lib/sales/demo-actions'
import { DEMO_NEEDS_OPTIONS } from '@/lib/sales/demo-config'

export const dynamic = 'force-dynamic'

export default async function BookDemoPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams
  const success = params.success === '1'
  const errorMessage = typeof params.error === 'string' && params.error.length < 300 ? params.error : null

  const industries = await getActiveIndustryProfiles()
  void trackProductEvent('demo_page_viewed')

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell space-y-6">
        <SiteHeader />

        {success ? (
          <section className="coordiqo-card mx-auto max-w-2xl p-8 text-center sm:p-10">
            <div className="coordiqo-badge coordiqo-badge--success">Ansökan mottagen</div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Tack — vi har tagit emot din förfrågan</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Vi återkommer för att förstå er verksamhet, visa rätt branschflöde och hjälpa er sätta upp en pilot.
            </p>
            <Link href="/" className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Till startsidan</Link>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <section className="coordiqo-card p-7 sm:p-9">
              <div className="coordiqo-badge coordiqo-badge--success">Boka demo</div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950">Berätta om er verksamhet</h1>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Vi lär oss om ert företag, förbereder rätt genomgång för er bransch och skapar er företagsmiljö med
                första administratör efter godkännande.
              </p>
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="font-semibold text-slate-950">Vad händer sen?</h2>
                <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>1. Vi går igenom er verksamhet och era behov.</li>
                  <li>2. Vi bokar en demo anpassad för er bransch.</li>
                  <li>3. Coordiqo-teamet skapar er miljö och första administratör.</li>
                  <li>4. Er administratör loggar in, byter lösenord och slutför onboarding.</li>
                </ol>
              </div>
            </section>

            <section className="coordiqo-card p-5 sm:p-7">
              {errorMessage ? (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
              ) : null}
              <form action={submitDemoRequestAction} className="grid gap-4">
                {/* Honeypot: hidden from humans, filled by bots. */}
                <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
                  <label>Lämna fältet tomt<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Företagsnamn"><input name="company_name" required maxLength={200} className={inputClassName} /></Field>
                  <Field label="Organisationsnummer"><input name="organization_number" maxLength={20} className={inputClassName} placeholder="559123-4567" /></Field>
                  <Field label="Kontaktperson"><input name="contact_name" required maxLength={200} className={inputClassName} /></Field>
                  <Field label="E-post"><input name="email" type="email" required maxLength={320} className={inputClassName} /></Field>
                  <Field label="Telefonnummer"><input name="phone" maxLength={30} className={inputClassName} /></Field>
                  <Field label="Bransch">
                    <select name="industry" defaultValue="other" className={selectClassName}>
                      {industries.map((industry) => <option key={industry.code} value={industry.code}>{industry.nameSv}</option>)}
                    </select>
                  </Field>
                  <Field label="Antal anställda">
                    <select name="employee_count" defaultValue="11-50" className={selectClassName}>
                      <option value="1-10">1–10</option>
                      <option value="11-50">11–50</option>
                      <option value="51-200">51–200</option>
                      <option value="201+">Fler än 200</option>
                    </select>
                  </Field>
                  <Field label="Antal uppdrag per vecka">
                    <select name="weekly_jobs_count" defaultValue="51-250" className={selectClassName}>
                      <option value="1-50">1–50</option>
                      <option value="51-250">51–250</option>
                      <option value="251-1000">251–1 000</option>
                      <option value="1000+">Fler än 1 000</option>
                    </select>
                  </Field>
                </div>

                <Field label="Vad vill ni förbättra?">
                  <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
                    {DEMO_NEEDS_OPTIONS.map((need) => (
                      <label key={need.code} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" name="needs" value={need.code} className="rounded border-slate-300" />
                        {need.label}
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="Önskat språk">
                  <select name="preferred_language" defaultValue="sv" className={selectClassName}>
                    <option value="sv">Svenska</option>
                    <option value="en">Engelska</option>
                  </select>
                </Field>

                <Field label="Meddelande"><textarea name="message" maxLength={4000} className={textareaClassName} placeholder="Berätta gärna kort om er verksamhet och vad ni vill lösa." /></Field>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  <input type="checkbox" name="consent" required className="mt-1" />
                  Jag godkänner att Coordiqo kontaktar mig angående denna förfrågan. Läs mer i vår <Link href="/integritetspolicy" className="underline underline-offset-2">integritetspolicy</Link>.
                </label>

                <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skicka demoansökan</button>
              </form>
            </section>
          </div>
        )}

        <SiteFooter />
      </div>
    </main>
  )
}
