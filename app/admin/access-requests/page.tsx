export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { isPlatformAdminRole } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { reviewCompanyAccessRequestAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

type AccessRequestRow = {
  id: string
  company_name: string | null
  request_type: string | null
  requested_role: string | null
  industry_type: string | null
  operational_model: string | null
  locale: string | null
  timezone: string | null
  currency: string | null
  reason?: string | null
  message: string | null
  status: string
  target_company_id: string | null
  reviewed_at: string | null
  review_note: string | null
}

type CompanyOptionRow = {
  id: string
  name: string
}

export default async function AdminAccessRequestsPage() {
  const auth = await requireAuth()
  if (!isPlatformAdminRole(auth.platformRole)) redirect('/dashboard')

  const [{ data: requests }, { data: companies }] = await Promise.all([
    supabaseAdmin.from('company_access_requests').select('*').order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('companies').select('id, name').order('name'),
  ])
  const accessRequests = (requests ?? []) as AccessRequestRow[]
  const companyOptions = (companies ?? []) as CompanyOptionRow[]

  return (
    <AppShell auth={auth} title="Bolagsansökningar" subtitle="Granska nya företag och användare som vill kopplas till ett bolag.">
      <div className="space-y-4">
        {accessRequests.map((request) => (
          <section key={request.id} className="coordiqo-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{request.company_name ?? 'Ansökan'}</h2>
                <p className="mt-1 text-sm text-slate-500">{request.request_type ?? 'access'} · önskad roll {request.requested_role ?? 'company_admin'}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {(request.industry_type ?? 'other')} · {(request.operational_model ?? 'case_based')} · {(request.locale ?? 'sv')} · {(request.timezone ?? 'Europe/Stockholm')} · {(request.currency ?? 'SEK')}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{request.reason ?? request.message ?? 'Ingen motivering angiven.'}</p>
              </div>
              <StatusBadge status={request.status} tone={request.status === 'pending' ? 'warning' : 'neutral'} />
            </div>
            {request.status === 'pending' ? (
              <form action={reviewCompanyAccessRequestAction} className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[200px_1fr_140px_140px]">
                <input type="hidden" name="request_id" value={request.id} />
                <select name="target_company_id" defaultValue={request.target_company_id ?? ''} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Skapa nytt bolag</option>
                  {companyOptions.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
                <input name="review_note" placeholder="Kommentar till beslut" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <button name="decision" value="approved" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Godkänn</button>
                <button name="decision" value="rejected" className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white">Neka</button>
              </form>
            ) : (
              <p className="mt-4 text-xs text-slate-500">Granskad {request.reviewed_at ? new Date(request.reviewed_at).toLocaleString('sv-SE') : 'utan datum'} · {request.review_note ?? 'ingen kommentar'}</p>
            )}
          </section>
        ))}
        {!accessRequests.length ? <section className="coordiqo-card p-6 text-sm text-slate-600">Inga ansökningar ännu.</section> : null}
      </div>
    </AppShell>
  )
}
