export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { SearchFilter } from '@/components/ui/search-filter'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const params = await searchParams
  const q = params.q?.trim()

  let query = supabaseAdmin
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, metadata, created_at, profiles(full_name, email)')
    .eq('company_id', auth.membership.companyId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (q) query = query.or(`action.ilike.%${q}%,entity_type.ilike.%${q}%`)

  const { data: events, error } = await query

  return (
    <AppShell auth={auth} title="Auditlogg" subtitle="Fullt ändringsspår för onboarding, objekt, uppdrag, permissions, invites och supportläge.">
      <div className="space-y-5">
        <SearchFilter action="/settings/audit" defaultValue={q} placeholder="Sök audit: create, task, entity, invite..." />
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}
        <div className="grid gap-3">
          {events?.length ? events.map((event: any) => (
            <div key={event.id} className="coordiqo-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{event.action} · {event.entity_type}</p>
                  <p className="mt-1 text-sm text-slate-500">{event.entity_id ?? 'saknar entity-id'} · {event.profiles?.full_name ?? event.profiles?.email ?? 'system'}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(event.created_at).toLocaleString('sv-SE')}</p>
                </div>
                <StatusBadge status={event.action} />
              </div>
              {event.metadata ? <pre className="mt-3 max-h-40 overflow-auto rounded-2xl bg-slate-950 p-3 text-xs text-slate-100 coordiqo-scrollbar">{JSON.stringify(event.metadata, null, 2)}</pre> : null}
            </div>
          )) : <p className="text-sm text-slate-600">Inga audit-händelser matchar filtret.</p>}
        </div>
      </div>
    </AppShell>
  )
}
