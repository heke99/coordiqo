export const dynamic = 'force-dynamic'

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
              <div className="coordiqo-badge coordiqo-badge--success">Coordiqo</div>
              <div>
                <p className="text-sm font-medium text-slate-500">Översikt</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {auth.profileName ? `Hej ${auth.profileName}` : 'Din dashboard är igång'}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Coordiqos grund är nu på plats för tenant, onboarding och dashboard. Nästa steg är att bygga team,
                  objekt, uppdrag och planeringsflöden ovanpå en stabil bas utan att gränssnittet känns som en demo.
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
                  Ditt konto är inloggat, men saknar ännu en aktiv företagstillhörighet. Fortsätt till uppsättningen för
                  att skapa eller koppla ditt första företag innan du använder plattformen vidare.
                </p>
              </div>
              <Link
                href="/setup"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Gå till setup
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="coordiqo-card p-5">
                <p className="text-sm font-medium text-slate-500">Aktivt företag</p>
                <h2 className="mt-3 text-lg font-semibold text-slate-950">{auth.membership.companyName}</h2>
                <p className="mt-2 text-sm text-slate-600">Slug: {auth.membership.companySlug ?? 'saknas ännu'}</p>
              </div>
              <div className="coordiqo-card p-5">
                <p className="text-sm font-medium text-slate-500">Företagsroll</p>
                <h2 className="mt-3 text-lg font-semibold text-slate-950">{auth.membership.companyRole}</h2>
                <p className="mt-2 text-sm text-slate-600">Rollbaserad styrning byggs vidare i nästa batch.</p>
              </div>
              <div className="coordiqo-card p-5">
                <p className="text-sm font-medium text-slate-500">Plattformsroll</p>
                <h2 className="mt-3 text-lg font-semibold text-slate-950">{auth.platformRole ?? 'Inte satt ännu'}</h2>
                <p className="mt-2 text-sm text-slate-600">Owner- och plattformslogik kommer i nästa steg.</p>
              </div>
              <div className="coordiqo-card p-5">
                <p className="text-sm font-medium text-slate-500">Nästa fokus</p>
                <h2 className="mt-3 text-lg font-semibold text-slate-950">Team, objekt och uppdrag</h2>
                <p className="mt-2 text-sm text-slate-600">Det är där den riktiga operativa nyttan börjar byggas.</p>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="coordiqo-card p-6">
                <h2 className="text-xl font-semibold text-slate-950">Vad som nu finns på plats</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <p className="text-sm font-semibold text-slate-900">Tenant-grund</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Företag, settings, memberships och teamkopplingar är på plats för en stabil B2B-grund.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <p className="text-sm font-semibold text-slate-900">Onboardingflöde</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Konto, setup och dashboard hänger ihop så att nya företag kan startas utan manuella SQL-steg.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <p className="text-sm font-semibold text-slate-900">UI-bas</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Ett rent och mobilvänligt visuellt lager finns redan från början, i stället för klassisk demo-känsla.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <p className="text-sm font-semibold text-slate-900">Redo för nästa batch</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Nu kan vi fortsätta med branschmotor, flexibel objekttyp-registrering, entities och uppdrag.
                    </p>
                  </div>
                </div>
              </div>

              <aside className="coordiqo-card p-6">
                <h2 className="text-xl font-semibold text-slate-950">Det som fortfarande saknas</h2>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                  <li>• invite flow för fler användare</li>
                  <li>• super admin- och owner-flöde</li>
                  <li>• full permissions matrix i UI</li>
                  <li>• företagssidor för team, objekt och uppdrag</li>
                  <li>• flexibel, branschstyrd objektmodell i Batch 2</li>
                </ul>
              </aside>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
