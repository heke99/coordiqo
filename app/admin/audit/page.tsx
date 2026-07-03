export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePlatformAdmin } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await requirePlatformAdmin()
  const params = await searchParams
  const action = typeof params.action === 'string' ? params.action : ''
  const entityType = typeof params.entity_type === 'string' ? params.entity_type : ''
  const companyId = typeof params.company_id === 'string' ? params.company_id : ''
  const q = typeof params.q === 'string' ? params.q : ''

  let query = supabaseAdmin
    .from('audit_logs')
    .select('id, company_id, actor_user_id, action, entity_type, entity_id, metadata, action_source, actor_role, entity_display_name, created_at, companies(name), profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (action) query = query.eq('action', action)
  if (entityType) query = query.eq('entity_type', entityType)
  if (companyId) query = query.eq('company_id', companyId)
  if (q) query = query.or(`action.ilike.%${q}%,entity_type.ilike.%${q}%,entity_id.ilike.%${q}%`)

  const [{ data: events }, { data: companies }] = await Promise.all([
    query,
    supabaseAdmin.from('companies').select('id, name').is('archived_at', null).order('name').limit(500),
  ])

  return (
    <AppShell auth={auth} title="Plattformsaudit" subtitle="All auditaktivitet i plattformen — bolagsstyrning, leads, supportåtgärder, planering och behörigheter.">
      <div className="space-y-5">
        <form className="coordiqo-card grid gap-3 p-5 md:grid-cols-[1fr_170px_170px_220px_auto]">
          <input name="q" defaultValue={q} placeholder="Sök händelse eller id" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input name="action" defaultValue={action} placeholder="Händelse" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input name="entity_type" defaultValue={entityType} placeholder="Typ" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <select name="company_id" defaultValue={companyId} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Alla bolag</option>
            {(companies ?? []).map((company: any) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
          <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filtrera</button>
        </form>

        <section className="coordiqo-card overflow-hidden">
          <div className="overflow-x-auto coordiqo-scrollbar">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left font-semibold">Tid</th><th className="px-4 py-3 text-left font-semibold">Bolag</th><th className="px-4 py-3 text-left font-semibold">Händelse</th><th className="px-4 py-3 text-left font-semibold">Objekt</th><th className="px-4 py-3 text-left font-semibold">Utförd av</th></tr></thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(events ?? []).map((event: any) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(event.created_at).toLocaleString('sv-SE')}</td>
                    <td className="px-4 py-3 text-slate-600">{event.companies?.name ?? 'Plattform'}</td>
                    <td className="px-4 py-3"><StatusBadge status={event.action} /></td>
                    <td className="px-4 py-3 text-slate-600"><span className="font-semibold text-slate-950">{event.entity_display_name ?? event.entity_type}</span></td>
                    <td className="px-4 py-3 text-slate-600">{event.profiles?.full_name ?? 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
