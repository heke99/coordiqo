import Link from 'next/link'

import { requireAuth } from '@/lib/auth/session'

export default async function DashboardPage() {
  const auth = await requireAuth()

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell space-y-6">
        <section className="coordiqo-card p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="coordiqo-badge coordiqo-badge--success">Coordiqo • Foundation</div>
              <div>
                <p className="text-sm font-medium text-slate-500">Välkommen</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {auth.profileName ? `Hej ${auth.profileName}` : 'Din dashboard är igång'}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Batch 1 är nu igång med login, tenant-grund, företagstillhörighet och en mobilvänlig
                  dashboardstruktur att bygga vidare på.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <form action="/api/logout" method="post">
                <button className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:w-auto">
                  Logga ut
                </button>
              </form>
            </div>
          </div>
        </section>

        {!auth.membership ? (
          <section className="coordiqo-card border border-amber-200 bg-amber-50/70 p-6 sm:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Du behöver slutföra onboarding</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                  Ditt konto finns, men det saknar ännu en aktiv företagstillhörighet. Fortsätt till setup så
                  skapas företag, membership och huvudteam korrekt.
                </p>
              </div>
              <Link
                href="/setup"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Slutför setup
              </Link>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="coordiqo-card p-5">
              <p className="text-sm font-medium text-slate-500">Aktivt företag</p>
              <h2 className="mt-3 text-lg font-semibold text-slate-950">{auth.membership.companyName}</h2>
              <p className="mt-2 text-sm text-slate-600">Tenant-klar grund för fortsatt byggnation.</p>
            </div>
            <div className="coordiqo-card p-5">
              <p className="text-sm font-medium text-slate-500">Din roll</p>
              <h2 className="mt-3 text-lg font-semibold text-slate-950">{auth.membership.companyRole}</h2>
              <p className="mt-2 text-sm text-slate-600">Behörigheter och navigation kan nu styras vidare.</p>
            </div>
            <div className="coordiqo-card p-5">
              <p className="text-sm font-medium text-slate-500">Plattformsroll</p>
              <h2 className="mt-3 text-lg font-semibold text-slate-950">{auth.platformRole ?? 'Ingen satt'}</h2>
              <p className="mt-2 text-sm text-slate-600">Owner bootstrap hålls kontrollerat separat.</p>
            </div>
            <div className="coordiqo-card p-5">
              <p className="text-sm font-medium text-slate-500">Status</p>
              <h2 className="mt-3 text-lg font-semibold text-slate-950">Batch 1B klar</h2>
              <p className="mt-2 text-sm text-slate-600">Redo för nästa batch med team, entities och tasks.</p>
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="coordiqo-card p-6">
            <h2 className="text-xl font-semibold text-slate-950">Vad som finns i den här batchen</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-sm font-semibold text-slate-900">Produktionshärdad grund</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Profiles, memberships, team-koppling, audit-logg och säkrare tenant-bootstrap i databasen.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-sm font-semibold text-slate-900">Bättre onboarding</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Konto → setup → företag → dashboard med tydligare steg och bättre mobilupplevelse.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-sm font-semibold text-slate-900">UI från början</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Renare visuellt lager, bättre spacing och kort som redan känns som en riktig plattform.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-sm font-semibold text-slate-900">Mobilvänlig struktur</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Alla nyckelvyer fungerar redan i en enkel, responsiv layout istället för desktop-only.
                </p>
              </div>
            </div>
          </div>

          <aside className="coordiqo-card p-6">
            <h2 className="text-xl font-semibold text-slate-950">Det som fortfarande saknas</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              <li>• invite flow för fler användare</li>
              <li>• super admin bootstrap-policy och owner assignment</li>
              <li>• full permissions matrix i UI</li>
              <li>• seed-data/dev bootstrap för fler roller</li>
              <li>• första företagssidor för team, entities och uppdrag</li>
            </ul>
          </aside>
        </section>
      </div>
    </main>
  )
}
