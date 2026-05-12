export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchFilter } from '@/components/ui/search-filter'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageStaff } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

type StaffPageProps = { searchParams?: Promise<{ q?: string; status?: string }> }

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const params = await searchParams
  const q = params?.q?.trim() ?? ''
  const status = params?.status ?? 'active'

  let query = supabaseAdmin
    .from('staff_profiles')
    .select('id, full_name, email, phone, employee_id, job_title, staff_kind, status, transport_mode, primary_team_id, teams(name)')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('full_name')

  if (status !== 'all') query = query.eq('status', status)
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,employee_id.ilike.%${q}%,job_title.ilike.%${q}%`)

  const { data: staff, error } = await query
  const canManage = canManageStaff(auth.membership.companyRole)

  return (
    <AppShell auth={auth} title="Personal" subtitle="Operativa personalprofiler, färdsätt, team och status.">
      <div className="space-y-5">
        <SearchFilter action="/staff" defaultValue={q} placeholder="Sök namn, e-post, anställnings-ID eller titel" newHref={canManage ? '/staff/new' : undefined} newLabel="Skapa personal">
          <select name="status" defaultValue={status} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
            <option value="active">Aktiva</option>
            <option value="inactive">Inaktiva</option>
            <option value="all">Alla</option>
          </select>
        </SearchFilter>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

        {!staff?.length ? (
          <EmptyState
            eyebrow="Batch 3"
            title="Lägg in första personalprofilen"
            description="Personalprofiler är inte samma sak som inloggningskonton. Här bygger vi den operativa bilden av vem som kan utföra arbete, vilket team personen tillhör och hur personen tar sig mellan uppdrag."
            action={canManage ? <Link className="inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" href="/staff/new">Skapa personal</Link> : undefined}
          />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {staff.map((person: any) => (
              <Link key={person.id} href={`/staff/${person.id}`} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-500">{person.employee_id ?? person.staff_kind}</p>
                    <h2 className="mt-2 truncate text-lg font-semibold text-slate-950">{person.full_name}</h2>
                  </div>
                  <StatusBadge status={person.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{person.job_title ?? 'Ingen titel'} · {person.transport_mode}</p>
                <p className="mt-2 text-sm text-slate-500">{person.teams?.name ?? 'Inget primärt team'}</p>
              </Link>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  )
}
