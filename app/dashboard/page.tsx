export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { CORE_MODULES } from '@/lib/industry/config'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

function countLabel(value: number | null | undefined) {
  return new Intl.NumberFormat('sv-SE').format(Number(value ?? 0))
}

const quickActions = [
  { href: '/operations/today', label: 'Öppna dagens kontrollpanel', description: 'Se uppdrag, rutter, resurser och avvikelser.' },
  { href: '/planning/assistant', label: 'Skapa plan med AI', description: 'Beskriv dagen och skapa ett planeringsutkast.' },
  { href: '/tasks/new', label: 'Skapa uppdrag', description: 'Lägg in ett nytt jobb, besök eller leverans.' },
  { href: '/resources/new', label: 'Skapa resurs', description: 'Lägg in nyckel, bil, cykel, verktyg eller utrustning.' },
]

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
            action={<Link className="inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" href="/setup">Fortsätt till setup</Link>}
          />
        </div>
      </main>
    )
  }

  const companyId = auth.membership.companyId
  const activeModules = new Set(auth.membership.activeModules)
  const [{ count: staffCount }, { count: teamCount }, { count: entityCount }, { count: taskCount }, { count: resourceCount }, { count: projectCount }, { count: openConflictCount }] = await Promise.all([
    supabaseAdmin.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('teams').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('entities').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('resource_assets').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('planning_conflicts').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('resolved_at', null),
  ])

  const readiness = [
    { label: 'Minst ett team', ok: Number(teamCount ?? 0) > 0, href: '/teams' },
    { label: 'Personal finns', ok: Number(staffCount ?? 0) > 0, href: '/staff' },
    { label: 'Objekt/kunder finns', ok: Number(entityCount ?? 0) > 0, href: '/entities' },
    { label: 'Uppdrag finns', ok: Number(taskCount ?? 0) > 0, href: '/tasks' },
    { label: 'Resurser finns', ok: Number(resourceCount ?? 0) > 0, href: '/resources' },
    { label: 'Branschmotor vald', ok: Boolean(auth.membership.industryType), href: '/settings/industry' },
  ]

  return (
    <AppShell
      auth={auth}
      title="Översikt"
      subtitle="Snabb kontroll över setup, data, dagens drift och vad som behöver fyllas på."
      actions={<Link href="/settings" className="hidden rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:inline-flex">Inställningar</Link>}
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Personal', value: staffCount, href: '/staff', hint: 'Utförare i planeringen' },
            { label: 'Uppdrag', value: taskCount, href: '/tasks', hint: 'Jobb, besök och leveranser' },
            { label: 'Resurser', value: resourceCount, href: '/resources', hint: 'Nycklar, fordon och utrustning' },
            { label: 'Öppna konflikter', value: openConflictCount, href: '/planning', hint: 'Behöver åtgärdas', danger: Number(openConflictCount ?? 0) > 0 },
          ].map((card) => (
            <Link key={card.label} href={card.href} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <h2 className={`mt-3 text-3xl font-semibold ${card.danger ? 'text-red-700' : 'text-slate-950'}`}>{countLabel(card.value)}</h2>
              <p className="mt-2 text-sm text-slate-600">{card.hint}</p>
            </Link>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="coordiqo-card p-6 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Arbetsflöde</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Bygg upp systemet i rätt ordning</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Den primära operativa modellen styr vad systemet prioriterar i vyer och mallar. Den låser inte bort andra flöden; projekt, resurser, uppdrag, rutter och operationsvy kan användas tillsammans.
                </p>
              </div>
              <Link href="/settings/industry" className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">Branschmotor</Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {readiness.map((item) => (
                <Link key={item.label} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.ok ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}>{item.ok ? 'Klar' : 'Saknas'}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="coordiqo-card p-6">
              <h2 className="text-xl font-semibold text-slate-950">Snabbåtgärder</h2>
              <div className="mt-5 space-y-3">
                {quickActions.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:bg-slate-50">
                    <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="coordiqo-card p-6">
              <h2 className="text-xl font-semibold text-slate-950">Aktiv profil</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge status={auth.membership.industryLabel} />
                <StatusBadge status={auth.membership.operationalModelLabel} />
                <StatusBadge status={`${countLabel(projectCount)} projekt`} />
                <StatusBadge status={`${countLabel(entityCount)} objekt`} />
              </div>
            </div>
          </aside>
        </section>

        <section className="coordiqo-card p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Aktiva moduler</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Onboarding och branschbyte ska aktivera hela kärnsystemet. Bransch och operativ modell styr prioritering, inte låsning.</p>
            </div>
            <Link href="/settings" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">Hantera</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_MODULES.map((module) => (
              <div key={module.code} className="rounded-2xl border border-slate-200 bg-white/75 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{module.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${activeModules.has(module.code) ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500'}`}>{activeModules.has(module.code) ? 'Aktiv' : 'Planerad'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
