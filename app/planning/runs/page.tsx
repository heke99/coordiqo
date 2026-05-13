export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function PlanningRunsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const { data: runs, error } = await supabaseAdmin
    .from('planning_runs')
    .select('id, name, status, date_from, date_to, created_at, summary, error_message, teams(name), staff_profiles(full_name), task_types(name)')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <AppShell auth={auth} title="Planeringskörningar" subtitle="Historik, status och utkast från planeringsmotorn." actions={<Link href="/planning/runs/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Ny körning</Link>}>
      <div className="space-y-4">
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}
        {runs?.length ? runs.map((run: any) => (
          <Link key={run.id} href={`/planning/runs/${run.id}`} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-950">{run.name}</p>
                <p className="mt-1 text-sm text-slate-500">{run.date_from ?? 'datum saknas'} – {run.date_to ?? run.date_from ?? 'datum saknas'} · {run.teams?.name ?? run.staff_profiles?.full_name ?? 'alla'}</p>
                <p className="mt-2 text-xs text-slate-500">{run.summary?.draftItems ?? 0} rader · {run.summary?.candidates ?? 0} kandidater · skapad {new Date(run.created_at).toLocaleString('sv-SE')}</p>
                {run.error_message ? <p className="mt-2 text-sm text-red-600">{run.error_message}</p> : null}
              </div>
              <StatusBadge status={run.status} />
            </div>
          </Link>
        )) : <EmptyState eyebrow="Batch 8A" title="Inga körningar ännu" description="Skapa en planeringskörning för att få draft, kandidater och konflikter." action={<Link href="/planning/runs/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Skapa körning</Link>} />}
      </div>
    </AppShell>
  )
}
