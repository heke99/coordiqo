export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { CORE_MODULES } from '@/lib/industry/config'
import { requireAuth } from '@/lib/auth/session'

export default async function DashboardPage() {
  const auth = await requireAuth()

  if (!auth.membership) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
        <div className="coordiqo-shell">
          <EmptyState
            eyebrow="Onboarding"
            title="Slutför din första företagsmiljö"
            description="Ditt konto är inloggat men saknar aktiv företagstillhörighet. Skapa eller koppla ditt första företag för att öppna Coordiqo-miljön."
            action={
              <Link className="inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" href="/setup">
                Fortsätt till setup
              </Link>
            }
          />
        </div>
      </main>
    )
  }

  const activeModules = new Set(auth.membership.activeModules)

  return (
    <AppShell
      auth={auth}
      title="Översikt"
      subtitle="Styr företagets branschläge, team, objekt och kommande operativa flöden från en gemensam grund."
      actions={
        <Link href="/settings/industry" className="hidden rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:inline-flex">
          Branschmotor
        </Link>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="coordiqo-card p-5">
            <p className="text-sm font-medium text-slate-500">Aktivt företag</p>
            <h2 className="mt-3 text-lg font-semibold text-slate-950">{auth.membership.companyName}</h2>
            <p className="mt-2 text-sm text-slate-600">{auth.membership.companySlug ?? 'slug saknas'}</p>
          </div>
          <div className="coordiqo-card p-5">
            <p className="text-sm font-medium text-slate-500">Branschläge</p>
            <h2 className="mt-3 text-lg font-semibold text-slate-950">{auth.membership.industryLabel}</h2>
            <p className="mt-2 text-sm text-slate-600">{auth.membership.operationalModelLabel}</p>
          </div>
          <div className="coordiqo-card p-5">
            <p className="text-sm font-medium text-slate-500">Aktiva moduler</p>
            <h2 className="mt-3 text-lg font-semibold text-slate-950">{auth.membership.activeModules.length}</h2>
            <p className="mt-2 text-sm text-slate-600">Moduler styr vad företaget ser och kan använda.</p>
          </div>
          <div className="coordiqo-card p-5">
            <p className="text-sm font-medium text-slate-500">Din roll</p>
            <h2 className="mt-3 text-lg font-semibold text-slate-950">{auth.membership.companyRole}</h2>
            <p className="mt-2 text-sm text-slate-600">Behörigheter förfinas löpande per modul.</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="coordiqo-card p-6 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Plattformsgrund</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Plattformen är redo för branschstyrning</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Coordiqo har nu ett produktmässigt appskal och en grund för branschstyrning. Objektmodellen låses inte tidigt, utan styrs av branschpresets och företagsanpassningar.
                </p>
              </div>
              <Link href="/settings/industry" className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
                Se konfiguration
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {CORE_MODULES.map((module) => (
                <div key={module.code} className="rounded-2xl border border-slate-200 bg-white/75 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{module.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${activeModules.has(module.code) ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                      {activeModules.has(module.code) ? 'Aktiv' : 'Planerad'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="coordiqo-card p-6">
              <h2 className="text-xl font-semibold text-slate-950">Nästa byggsteg</h2>
              <div className="mt-5 space-y-3">
                {[
                  'Personal, resurser och organisation',
                  'Branschstyrda objekt och platser',
                  'Uppdrag, ärenden och arbetsorder',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="coordiqo-card p-6">
              <h2 className="text-xl font-semibold text-slate-950">Saknas fortfarande</h2>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                <li>• invite flow för fler användare</li>
                <li>• full permissions matrix i UI</li>
                <li>• riktig super admin-vy</li>
                <li>• seed/importflöde för större kunddata</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  )
}
