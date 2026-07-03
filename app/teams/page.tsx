export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchFilter } from '@/components/ui/search-filter'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageTeams } from '@/lib/auth/permissions'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

type TeamsPageProps = {
  searchParams?: Promise<{ q?: string }>
}

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const auth = await requireCompanyContext()

  const params = await searchParams
  const q = params?.q?.trim() ?? ''

  let query = supabaseAdmin
    .from('teams')
    .select('id, name, code, description, status, created_at')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('created_at', { ascending: true })

  if (q) {
    query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,description.ilike.%${q}%`)
  }

  const { data: teams, error } = await query
  const canManage = canManageTeams(auth.membership.companyRole)

  return (
    <AppShell auth={auth} title="Team" subtitle="Grupper, huvudteam, distrikt och ansvar som planeringen bygger på.">
      <div className="space-y-5">
        <SearchFilter action="/teams" defaultValue={q} placeholder="Sök team, kod eller beskrivning" newHref={canManage ? '/teams/new' : undefined} newLabel="Skapa team" />

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

        {!teams?.length ? (
          <EmptyState
            eyebrow="Organisation"
            title="Inga team matchar ännu"
            description="Skapa dagteam, kvällsteam, distrikt, patruller eller projektteam. Team är grunden för personal, objekt och kommande planering."
            action={canManage ? <Link className="inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" href="/teams/new">Skapa första teamet</Link> : undefined}
          />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => (
              <Link key={team.id} href={`/teams/${team.id}`} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{team.code ?? 'TEAM'}</p>
                    <h2 className="mt-2 text-lg font-semibold text-slate-950">{team.name}</h2>
                  </div>
                  <StatusBadge status={team.status} />
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{team.description ?? 'Team utan beskrivning ännu.'}</p>
              </Link>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  )
}
