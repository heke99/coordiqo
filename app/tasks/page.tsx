export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchFilter } from '@/components/ui/search-filter'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const params = await searchParams
  const q = params.q?.trim()
  const status = params.status?.trim()

  let query = supabaseAdmin
    .from('tasks')
    .select('id, title, status, priority, time_window_start, scheduled_start, estimated_duration_minutes, entities(name), teams(name), staff_profiles(full_name)')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (q) query = query.ilike('title', `%${q}%`)
  if (status) query = query.eq('status', status)

  const { data: tasks, error } = await query

  return (
    <AppShell
      auth={auth}
      title="Uppdrag"
      subtitle="Skapa, filtrera och följ upp oschemalagda, schemalagda och tilldelade uppdrag."
      actions={<Link href="/tasks/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Nytt uppdrag</Link>}
    >
      <div className="space-y-5">
        <SearchFilter action="/tasks" defaultValue={q} placeholder="Sök uppdrag" newHref="/tasks/new" newLabel="Nytt uppdrag">
          <select name="status" defaultValue={status ?? ''} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
            <option value="">Alla statusar</option>
            <option value="unscheduled">Oschemalagt</option>
            <option value="scheduled">Schemalagt</option>
            <option value="assigned">Tilldelat</option>
            <option value="in_progress">Pågår</option>
            <option value="blocked">Blockerat</option>
            <option value="completed">Klart</option>
          </select>
        </SearchFilter>
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}
        {tasks?.length ? (
          <div className="grid gap-3">
            {tasks.map((task: any) => (
              <Link key={task.id} href={`/tasks/${task.id}`} className="coordiqo-card block p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-950">{task.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{task.entities?.name ?? 'Inget objekt'} · {task.teams?.name ?? task.staff_profiles?.full_name ?? 'Ej tilldelat'}</p>
                    <p className="mt-1 text-xs text-slate-400">{task.scheduled_start ? `Planerad ${new Date(task.scheduled_start).toLocaleString('sv-SE')}` : task.time_window_start ? `Tidsfönster ${new Date(task.time_window_start).toLocaleString('sv-SE')}` : 'Oschemalagd'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState eyebrow="Uppdrag" title="Inga uppdrag ännu" description="Skapa första uppdraget och koppla det till objekt, team, personal och tidsfönster." action={<Link href="/tasks/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Skapa uppdrag</Link>} />
        )}
      </div>
    </AppShell>
  )
}
