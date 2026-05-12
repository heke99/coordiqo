export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchFilter } from '@/components/ui/search-filter'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AbsencesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const params = await searchParams
  let query = supabaseAdmin.from('absences').select('id, starts_at, ends_at, status, reason, affects_planning, staff_profiles(full_name), absence_types(name)').eq('company_id', auth.membership.companyId).is('archived_at', null).order('starts_at', { ascending: false }).limit(150)
  if (params.status) query = query.eq('status', params.status)
  const { data: absences, error } = await query
  return <AppShell auth={auth} title="Frånvaro" subtitle="Sjukdom, semester, utbildning och andra blockeringar som påverkar planeringen." actions={<Link href="/absences/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Ny frånvaro</Link>}><div className="space-y-5"><SearchFilter action="/absences" placeholder="Sökning kommer i nästa steg" newHref="/absences/new" newLabel="Ny frånvaro"><select name="status" defaultValue={params.status ?? ''} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"><option value="">Alla statusar</option><option value="requested">Begärd</option><option value="approved">Godkänd</option><option value="active">Aktiv</option><option value="completed">Klar</option><option value="cancelled">Avbokad</option></select></SearchFilter>{error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}{absences?.length ? <div className="grid gap-3">{absences.map((a: any) => <Link key={a.id} href={`/absences/${a.id}`} className="coordiqo-card block p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-base font-semibold text-slate-950">{a.staff_profiles?.full_name ?? 'Personal'} · {a.absence_types?.name ?? 'Frånvaro'}</p><p className="mt-1 text-sm text-slate-500">{new Date(a.starts_at).toLocaleString('sv-SE')} – {new Date(a.ends_at).toLocaleString('sv-SE')}</p><p className="mt-1 text-xs text-slate-400">{a.reason ?? 'Ingen anledning'}{a.affects_planning ? ' · påverkar planering' : ''}</p></div><StatusBadge status={a.status} /></div></Link>)}</div> : <EmptyState eyebrow="Batch 7" title="Ingen frånvaro registrerad" description="Lägg in sjukdom, semester eller blockeringar så planeringsmotorn inte väljer fel personal." action={<Link href="/absences/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Skapa frånvaro</Link>} />}</div></AppShell>
}
