export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchFilter } from '@/components/ui/search-filter'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ q?: string; date?: string; status?: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const params = await searchParams
  const q = params.q?.trim()
  const date = params.date?.trim()
  const status = params.status?.trim()

  let query = supabaseAdmin
    .from('shifts')
    .select('id, title, shift_date, starts_at, ends_at, status, capacity_minutes, planned_minutes, remaining_minutes, planning_locked, staff_profiles(full_name), teams(name)')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('starts_at', { ascending: true })
    .limit(150)
  if (date) query = query.eq('shift_date', date)
  if (status) query = query.eq('status', status)
  if (q) query = query.ilike('title', `%${q}%`)
  const { data: shifts, error } = await query

  return (
    <AppShell auth={auth} title="Schema" subtitle="Pass, kapacitet, start/slutplats och låsningar som planeringsmotorn använder." actions={<Link href="/schedule/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Nytt pass</Link>}>
      <div className="space-y-5">
        <SearchFilter action="/schedule" defaultValue={q} placeholder="Sök pass" newHref="/schedule/new" newLabel="Nytt pass">
          <input name="date" type="date" defaultValue={date ?? ''} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
          <select name="status" defaultValue={status ?? ''} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"><option value="">Alla statusar</option><option value="draft">Utkast</option><option value="planned">Planerat</option><option value="confirmed">Bekräftat</option><option value="cancelled">Avbokat</option></select>
        </SearchFilter>
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}
        {shifts?.length ? <div className="grid gap-3">{shifts.map((shift: any) => <Link key={shift.id} href={`/schedule/${shift.id}`} className="coordiqo-card block p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-base font-semibold text-slate-950">{shift.title ?? 'Pass'}</p><p className="mt-1 text-sm text-slate-500">{shift.staff_profiles?.full_name ?? shift.teams?.name ?? 'Ej kopplat'} · {new Date(shift.starts_at).toLocaleString('sv-SE')}–{new Date(shift.ends_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</p><p className="mt-1 text-xs text-slate-400">Kapacitet {shift.capacity_minutes ?? 0} min · Planerat {shift.planned_minutes ?? 0} min · Kvar {shift.remaining_minutes ?? 0} min{shift.planning_locked ? ' · låst' : ''}</p></div><StatusBadge status={shift.status} /></div></Link>)}</div> : <EmptyState eyebrow="Batch 7" title="Inga pass ännu" description="Skapa manuella pass eller använd tillgänglighetsmallar för att skapa schema för personal och team." action={<Link href="/schedule/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Skapa pass</Link>} />}
      </div>
    </AppShell>
  )
}
