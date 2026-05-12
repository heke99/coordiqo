export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function TeamsPage() {
  const auth = await requireAuth()

  if (!auth.membership) {
    return null
  }

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name, code, description, status, created_at')
    .eq('company_id', auth.membership.companyId)
    .order('created_at', { ascending: true })

  return (
    <AppShell auth={auth} title="Team" subtitle="Grupper, huvudteam och framtida ansvarsområden för planeringen.">
      <div className="space-y-6">
        <EmptyState
          eyebrow="Organisation"
          title="Teamstrukturen är grunden för planering"
          description="Här kommer företaget kunna skapa dagteam, kvällsteam, distrikt, patruller, projektteam och andra grupper. Första huvudteamet finns redan från onboarding."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(teams ?? []).map((team) => (
            <div key={team.id} className="coordiqo-card p-5">
              <p className="text-sm font-medium text-slate-500">{team.code ?? 'TEAM'}</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">{team.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{team.description ?? 'Team utan beskrivning ännu.'}</p>
              <span className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                {team.status}
              </span>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  )
}
