export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { PermissionMatrix } from '@/components/settings/permission-matrix'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function PermissionsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const [{ data: auditEvents }, { data: permissions }] = await Promise.all([
    supabaseAdmin
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, created_at')
    .eq('company_id', auth.membership.companyId)
    .order('created_at', { ascending: false })
    .limit(8),
    supabaseAdmin
      .from('company_role_permissions')
      .select('role, permission_key, is_allowed, source')
      .eq('company_id', auth.membership.companyId),
  ])

  return (
    <AppShell auth={auth} title="Behörigheter" subtitle="Rollmatris, audit-spår och grund för organisationsstyrning.">
      <div className="space-y-5">
        <PermissionMatrix permissions={permissions ?? []} />

        <section className="coordiqo-card p-5 sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Senaste audit-händelser</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Här visas de senaste ändringarna i företagsmiljön. Full audit-vy kommer senare, men grunden är redan aktiv.</p>
          <div className="mt-5 space-y-3">
            {auditEvents?.length ? auditEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">{event.action} · {event.entity_type}</p>
                <p className="mt-1 text-xs text-slate-500">{event.entity_id ?? 'saknar objekt-id'} · {new Date(event.created_at).toLocaleString('sv-SE')}</p>
              </div>
            )) : <p className="text-sm text-slate-600">Inga audit-händelser ännu.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
