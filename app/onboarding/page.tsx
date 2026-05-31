export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { isPlatformAdminRole } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { completeOnboardingAction } from '@/lib/sales/demo-actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

const steps = [
  ['company_information', 'Company information', 'Confirm company name, org number, language, timezone and currency.'],
  ['industry_model', 'Industry model', 'Choose a starting model for templates and labels. It never locks the system.'],
  ['modules', 'Modules', 'Review active modules and decide what should be visible first.'],
  ['staff_team', 'Staff/team setup', 'Add initial teams, roles and staff structure.'],
  ['customers_objects', 'Customers/objects/patients setup', 'Prepare customer, object or patient records for operations.'],
  ['planning_defaults', 'Planning defaults', 'Review default rules, templates and planning assumptions.'],
  ['finish', 'Finish', 'Open the dashboard and continue configuration later.'],
]

export default async function OnboardingPage() {
  const auth = await requireAuth()
  if (!auth.membership) redirect('/login')

  const { data: session } = await supabaseAdmin
    .from('company_onboarding_sessions')
    .select('*')
    .eq('company_id', auth.membership.companyId)
    .maybeSingle()

  if (session?.status === 'completed') redirect('/dashboard')
  const canComplete = auth.membership.companyRole === 'company_admin' || isPlatformAdminRole(auth.platformRole)

  return (
    <AppShell
      auth={auth}
      title="Company onboarding"
      subtitle="Prepare the company for first use. Templates and presets are editable starting defaults only."
      actions={<Link href="/settings" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Settings</Link>}
    >
      <div className="space-y-5">
        <section className="coordiqo-card bg-slate-950 p-6 text-white">
          <h2 className="text-2xl font-semibold tracking-tight">Your selected industry model only prepares templates and defaults.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            It does not limit the system. You can change modules, templates, labels and workflows later.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {steps.map(([key, title, description], index) => (
            <div key={key} className="coordiqo-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step {index + 1}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </div>
                <StatusBadge status={session?.completed_steps?.includes(key) ? 'Ready' : 'Needs action'} tone={session?.completed_steps?.includes(key) ? 'success' : 'warning'} />
              </div>
              <input form="complete-onboarding" type="hidden" name="completed_steps" value={key} />
            </div>
          ))}
        </section>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Editable after onboarding</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {['Industry model', 'Active modules', 'Planning templates', 'Project templates', 'Shift presets', 'Resource types', 'Labels/naming', 'Workflow rules', 'Language', 'AI/planning defaults'].map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item}</span>
            ))}
          </div>
          <form id="complete-onboarding" action={completeOnboardingAction} className="mt-6">
            <button disabled={!canComplete} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">Finish onboarding</button>
          </form>
        </section>
      </div>
    </AppShell>
  )
}

