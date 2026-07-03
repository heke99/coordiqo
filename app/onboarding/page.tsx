export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { requireCompanyContext } from '@/lib/auth/guards'
import { isPlatformAdminRole } from '@/lib/auth/permissions'
import { getOnboardingProgress } from '@/lib/onboarding/progress'
import {
  completeOnboardingAction,
  repairOnboardingDefaultsAction,
  updateOnboardingStepAction,
} from '@/lib/sales/demo-actions'

export default async function OnboardingPage() {
  const auth = await requireCompanyContext()

  const progress = await getOnboardingProgress(auth.membership.companyId, auth.membership.industryType)

  if (progress.isComplete) redirect('/dashboard')

  const canManage =
    auth.membership.companyRole === 'company_admin' ||
    auth.membership.companyRole === 'operations_manager' ||
    isPlatformAdminRole(auth.platformRole)

  const requiredSteps = progress.steps.filter((status) => status.step.required)
  const requiredDone = requiredSteps.filter((status) => status.done || status.step.key === 'finish').length
  const percent = Math.round((progress.completedCount / Math.max(progress.totalCount, 1)) * 100)
  const readyToFinish = progress.requiredRemaining.length === 0

  return (
    <AppShell
      auth={auth}
      title="Kom igång med Coordiqo"
      subtitle={`Anpassad start för ${progress.profile.nameSv.toLowerCase()}. Din framsteg sparas automatiskt — du kan fortsätta när som helst.`}
      actions={<Link href="/dashboard" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Till översikten</Link>}
    >
      <div className="space-y-5">
        <section className="coordiqo-card bg-slate-950 p-6 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Gör klart grunderna för {auth.membership.companyName}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Stegen nedan är anpassade efter er bransch. Obligatoriska steg behöver vara klara innan onboarding kan slutföras —
                allt annat kan justeras senare.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl bg-white/10 px-5 py-4 text-center">
              <p className="text-3xl font-semibold">{percent}%</p>
              <p className="mt-1 text-xs text-slate-300">{progress.completedCount} av {progress.totalCount} steg klara</p>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {progress.steps.map((status, index) => {
            const isFinish = status.step.key === 'finish'
            return (
              <div key={status.step.key} className={`coordiqo-card p-5 ${status.done ? 'opacity-90' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Steg {index + 1}{status.step.required ? '' : ' · valfritt'}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">{status.step.title}</h2>
                    {status.step.description && <p className="mt-2 text-sm leading-6 text-slate-600">{status.step.description}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.done ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}>
                    {status.done ? 'Klar' : 'Kvar'}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {status.step.href && !isFinish && (
                    <Link href={status.step.href} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
                      Öppna
                    </Link>
                  )}
                  {canManage && !isFinish && (
                    <form action={updateOnboardingStepAction}>
                      <input type="hidden" name="step_key" value={status.step.key} />
                      <input type="hidden" name="done" value={status.manuallyMarked ? 'false' : 'true'} />
                      <button className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
                        {status.manuallyMarked ? 'Ångra markering' : status.done ? 'Bekräfta som klar' : 'Markera som klar'}
                      </button>
                    </form>
                  )}
                  {status.autoDetected && !status.manuallyMarked && !isFinish && (
                    <span className="text-xs text-slate-400">Upptäckt automatiskt</span>
                  )}
                </div>
              </div>
            )
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Slutför onboarding</h2>
            {readyToFinish ? (
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Alla obligatoriska steg är klara ({requiredDone} av {requiredSteps.length}). När du slutför öppnas översikten
                och ni kan börja planera på riktigt.
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Följande obligatoriska steg behöver bli klara först:{' '}
                <span className="font-semibold text-slate-900">
                  {progress.requiredRemaining.map((status) => status.step.title).join(', ')}
                </span>
              </p>
            )}
            <form action={completeOnboardingAction} className="mt-5">
              <button
                disabled={!canManage || !readyToFinish}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Slutför onboarding
              </button>
            </form>
            {!canManage && (
              <p className="mt-3 text-xs text-slate-500">Endast företagsadministratörer kan slutföra onboarding.</p>
            )}
          </div>

          <div className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Saknas standardinnehåll?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Om uppdragstyper, resurstyper eller objekttyper saknas kan du skapa om standardinnehållet för er bransch.
              Befintliga uppgifter påverkas inte.
            </p>
            {canManage && (
              <form action={repairOnboardingDefaultsAction} className="mt-4">
                <button className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
                  Skapa saknade standardinställningar
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
