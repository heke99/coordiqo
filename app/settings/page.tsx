export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { requireAuth } from '@/lib/auth/session'

const settingsAreas = [
  {
    href: '/settings/industry',
    title: 'Branschmotor',
    description: 'Bransch, operativ modell, moduler och branschstyrd navigation.',
  },
  {
    href: '/settings/entity-types',
    title: 'Objekttyper',
    description: 'Dynamiska objekttyper, fält och branschspecifika labels utan hårdkodning.',
  },
  {
    href: '/settings/invitations',
    title: 'Inbjudningar',
    description: 'Skapa och följ upp inbjudningar innan användaren finns som auth-konto.',
  },
  {
    href: '/settings/permissions',
    title: 'Behörigheter',
    description: 'Rollmatris, auditöversikt och grund för framtida permissions overrides.',
  },
]

export default async function SettingsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  return (
    <AppShell auth={auth} title="Inställningar" subtitle="Företagets grundinställningar, branschmotor, objektmodell, användare och säkerhet.">
      <div className="grid gap-5 md:grid-cols-2">
        {settingsAreas.map((area) => (
          <Link key={area.href} href={area.href} className="coordiqo-card block p-6 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-8">
            <p className="text-sm font-medium text-slate-500">Inställning</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{area.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{area.description}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
