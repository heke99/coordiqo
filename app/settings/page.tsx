export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { requireAuth } from '@/lib/auth/session'

export default async function SettingsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  return (
    <AppShell auth={auth} title="Inställningar" subtitle="Företagets grundinställningar, moduler och framtida säkerhetsval.">
      <div className="grid gap-5 lg:grid-cols-2">
        <EmptyState
          eyebrow="Företagsinställningar"
          title="Inställningar byggs modul för modul"
          description="Den här sidan är navet för kommande inställningar: användare, roller, säkerhet, moduler, integrationer och billing. Branschmotorn är första konkreta inställningssidan."
          action={
            <Link href="/settings/industry" className="inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Öppna branschmotor
            </Link>
          }
        />

        <section className="coordiqo-card p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Kommande inställningsområden</h2>
          <div className="mt-5 space-y-3">
            {[
              'Användare och invite flow',
              'Permissions matrix och roller',
              'Feature gates och abonnemang',
              'Audit, supportläge och säkerhet',
              'Integrationer och API-nycklar',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
