export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { isPlatformAdminRole } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await requireAuth()
  if (!auth.membership && !isPlatformAdminRole(auth.platformRole)) return null
  const params = await searchParams
  const action = typeof params.action === 'string' ? params.action : ''
  const entityType = typeof params.entity_type === 'string' ? params.entity_type : ''
  const q = typeof params.q === 'string' ? params.q : ''

  let query = supabaseAdmin
    .from('audit_logs')
    .select('id, company_id, actor_user_id, action, entity_type, entity_id, metadata, action_source, actor_role, entity_display_name, before_value, after_value, request_id, created_at, companies(name), profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(150)

  if (!isPlatformAdminRole(auth.platformRole)) query = query.eq('company_id', auth.membership!.companyId)
  if (action) query = query.eq('action', action)
  if (entityType) query = query.eq('entity_type', entityType)
  if (q) query = query.or(`action.ilike.%${q}%,entity_type.ilike.%${q}%,entity_id.ilike.%${q}%`)

  const { data: events } = await query

  return (
    <AppShell auth={auth} title="Auditlogg" subtitle="Spårbarhet för viktiga ändringar, overrides, publiceringar, invites och supportåtgärder.">
      <div className="space-y-5">
        <form className="coordiqo-card grid gap-3 p-5 md:grid-cols-[1fr_180px_180px_auto]">
          <input name="q" defaultValue={q} placeholder="Sök action, entity eller id" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input name="action" defaultValue={action} placeholder="Action" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input name="entity_type" defaultValue={entityType} placeholder="Entity type" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filtrera</button>
        </form>

        <section className="coordiqo-card overflow-hidden">
          <div className="overflow-x-auto coordiqo-scrollbar">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left font-semibold">Tid</th><th className="px-4 py-3 text-left font-semibold">Bolag</th><th className="px-4 py-3 text-left font-semibold">Action</th><th className="px-4 py-3 text-left font-semibold">Entity</th><th className="px-4 py-3 text-left font-semibold">Actor</th><th className="px-4 py-3 text-left font-semibold">Källa</th><th className="px-4 py-3 text-left font-semibold">Metadata</th></tr></thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(events ?? []).map((event: any) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(event.created_at).toLocaleString('sv-SE')}</td>
                    <td className="px-4 py-3 text-slate-600">{event.companies?.name ?? 'Plattform'}</td>
                    <td className="px-4 py-3"><StatusBadge status={event.action} /></td>
                    <td className="px-4 py-3 text-slate-600"><span className="font-semibold text-slate-950">{event.entity_display_name ?? event.entity_type}</span><br /><span className="text-xs">{event.entity_type} · {event.entity_id ?? 'saknas'}</span></td>
                    <td className="px-4 py-3 text-slate-600">{event.profiles?.full_name ?? event.actor_user_id}<br /><span className="text-xs text-slate-400">{event.actor_role ?? 'roll saknas'}</span></td>
                    <td className="px-4 py-3 text-slate-600"><StatusBadge status={event.action_source ?? event.metadata?.source ?? 'manual'} /></td>
                    <td className="max-w-md px-4 py-3"><pre className="max-h-28 overflow-auto rounded-xl bg-slate-50 p-2 text-xs text-slate-600 coordiqo-scrollbar">{JSON.stringify(event.metadata ?? {}, null, 2)}</pre></td>
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
