export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'

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

  return (
    <AppShell
      auth={auth}
      title="Inställningar"
      subtitle="Samlad plats för företagsprofil, branschmotor, kompetenser, resurser och operativa grunddata."
    >
      <div className="space-y-5">
        <section className="coordiqo-card bg-slate-950 p-6 text-white sm:p-7">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-slate-300">Systemprofil</p>
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
