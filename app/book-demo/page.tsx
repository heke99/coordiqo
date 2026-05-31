import Link from 'next/link'

import { Field, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { submitDemoRequestAction } from '@/lib/sales/demo-actions'

const industries = [
  { value: 'courier', label: 'Transport / courier' },
  { value: 'cleaning', label: 'Cleaning / service' },
  { value: 'home_care', label: 'Home care' },
  { value: 'property', label: 'Property service' },
  { value: 'construction', label: 'Construction / projects' },
  { value: 'municipality', label: 'Municipality' },
  { value: 'field_service', label: 'Field service' },
  { value: 'other', label: 'Other' },
]

const needs = [
  'Staff planning',
  'Route optimization',
  'Resource tracking',
  'Project calculation',
  'Mobile staff execution',
  'Deviation handling',
  'AI planning support',
  'Reporting and invoicing support',
]

export default async function BookDemoPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const params = await searchParams
  const success = params.success === '1'

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell space-y-6">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <Link href="/" className="font-semibold tracking-tight text-slate-950">Coordiqo</Link>
          <Link href="/login" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">Log in</Link>
        </header>

        {success ? (
          <section className="coordiqo-card mx-auto max-w-2xl p-8 text-center sm:p-10">
            <div className="coordiqo-badge coordiqo-badge--success">Request received</div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">Thanks — we will contact you</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your request has been saved. A Coordiqo team member will contact you to understand your company and book a guided walkthrough.
            </p>
            <Link href="/" className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Back to start</Link>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <section className="coordiqo-card p-7 sm:p-9">
              <div className="coordiqo-badge coordiqo-badge--success">Book demo</div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950">Tell us about your operations</h1>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Coordiqo uses guided onboarding. We learn about your company, prepare the right walkthrough and create your company workspace and first administrator account after approval.
              </p>
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="font-semibold text-slate-950">What happens next?</h2>
                <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>1. We review your company and use case.</li>
                  <li>2. We book a guided walkthrough.</li>
                  <li>3. The Coordiqo team creates your company and first administrator manually.</li>
                  <li>4. Your company admin changes temporary password and completes onboarding.</li>
                </ol>
              </div>
            </section>

            <section className="coordiqo-card p-5 sm:p-7">
              <form action={submitDemoRequestAction} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company name"><input name="company_name" required className={inputClassName} /></Field>
                  <Field label="Organization number"><input name="organization_number" className={inputClassName} /></Field>
                  <Field label="Contact name"><input name="contact_name" required className={inputClassName} /></Field>
                  <Field label="Email"><input name="email" type="email" required className={inputClassName} /></Field>
                  <Field label="Phone"><input name="phone" className={inputClassName} /></Field>
                  <Field label="Industry">
                    <select name="industry" defaultValue="courier" className={selectClassName}>
                      {industries.map((industry) => <option key={industry.value} value={industry.value}>{industry.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Employee count">
                    <select name="employee_count" defaultValue="11-50" className={selectClassName}>
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="201+">201+</option>
                    </select>
                  </Field>
                  <Field label="Weekly jobs count">
                    <select name="weekly_jobs_count" defaultValue="51-250" className={selectClassName}>
                      <option value="1-50">1-50</option>
                      <option value="51-250">51-250</option>
                      <option value="251-1000">251-1000</option>
                      <option value="1000+">1000+</option>
                    </select>
                  </Field>
                </div>

                <Field label="Needs">
                  <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
                    {needs.map((need) => (
                      <label key={need} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" name="needs" value={need} className="rounded border-slate-300" />
                        {need}
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="Preferred language">
                  <select name="preferred_language" defaultValue="sv" className={selectClassName}>
                    <option value="sv">Swedish</option>
                    <option value="en">English</option>
                  </select>
                </Field>

                <Field label="Message"><textarea name="message" className={textareaClassName} /></Field>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  <input type="checkbox" name="consent" required className="mt-1" />
                  I agree that Coordiqo may contact me about this request.
                </label>

                <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Request access</button>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}

