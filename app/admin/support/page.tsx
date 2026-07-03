export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePlatformAdmin } from '@/lib/auth/guards'
import { updateSupportRequestAction } from '@/lib/support/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

const STATUS_LABELS: Record<string, string> = {
  new: 'Ny',
  in_progress: 'Pågår',
  waiting_for_customer: 'Väntar på kund',
  resolved: 'Löst',
  archived: 'Arkiverad',
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Låg',
  normal: 'Normal',
  high: 'Hög',
  critical: 'Kritisk',
}

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const auth = await requirePlatformAdmin()
  const params = await searchParams
  const statusFilter = params.status && STATUS_LABELS[params.status] ? params.status : ''

  let query = supabaseAdmin
    .from('support_requests')
    .select('id, company_id, subject, message, severity, status, related_url, created_at, companies(name), profiles!support_requests_created_by_fkey(full_name), assigned:profiles!support_requests_assigned_to_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (statusFilter) query = query.eq('status', statusFilter)

  const [{ data: requests }, { data: admins }] = await Promise.all([
    query,
    supabaseAdmin.from('profiles').select('id, full_name, platform_role').in('platform_role', ['owner', 'platform_admin', 'support_admin']),
  ])

  return (
    <AppShell auth={auth} title="Supportärenden" subtitle="Kundernas supportförfrågningar med status, ansvar och historik.">
      <div className="space-y-5">
        <form className="coordiqo-card flex flex-wrap items-end gap-3 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
            <select name="status" defaultValue={statusFilter} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Alla</option>
              {Object.entries(STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
          <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filtrera</button>
        </form>

        <section className="space-y-4">
          {requests?.length ? requests.map((request: any) => (
            <div key={request.id} className="coordiqo-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-950">{request.subject}</h2>
                    <StatusBadge status={STATUS_LABELS[request.status] ?? request.status} tone={request.status === 'new' ? 'warning' : request.status === 'resolved' ? 'success' : 'neutral'} />
                    <StatusBadge status={SEVERITY_LABELS[request.severity] ?? request.severity} tone={['high', 'critical'].includes(request.severity) ? 'danger' : 'neutral'} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {request.companies?.name ?? 'Okänt bolag'} · {request.profiles?.full_name ?? 'Okänd användare'} · {new Date(request.created_at).toLocaleString('sv-SE')}
                    {request.assigned?.full_name ? ` · Ansvarig: ${request.assigned.full_name}` : ''}
                  </p>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{request.message}</p>
                  {request.related_url ? <p className="mt-2 text-xs text-slate-500">Relaterad sida: {request.related_url}</p> : null}
                </div>
                <form action={updateSupportRequestAction} className="grid w-full max-w-xs gap-3">
                  <input type="hidden" name="id" value={request.id} />
                  <select name="status" defaultValue={request.status} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    {Object.entries(STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                  <select name="assigned_to" defaultValue={request.assigned_to ?? ''} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Ingen ansvarig</option>
                    {(admins ?? []).map((admin: any) => <option key={admin.id} value={admin.id}>{admin.full_name ?? admin.id}</option>)}
                  </select>
                  <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Uppdatera</button>
                </form>
              </div>
            </div>
          )) : (
            <div className="coordiqo-card p-8 text-center text-sm text-slate-600">Inga supportärenden{statusFilter ? ' med vald status' : ''}.</div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
