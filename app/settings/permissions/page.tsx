export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { PermissionMatrix } from '@/components/settings/permission-matrix'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function SettingsPermissionsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const { data: permissions } = await supabaseAdmin
    .from('company_role_permissions')
    .select('role, permission_key, is_allowed, source')
    .eq('company_id', auth.membership.companyId)
    .order('role')
    .order('permission_key')

  return (
    <AppShell auth={auth} title="Behörigheter" subtitle="Company-specifika permission overrides. Matrisen styr vilka roller som får se och göra vad i bolaget.">
      <div className="space-y-5">
        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Viktigt om RBAC</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Superadmin är plattformsroll. Company-roller gäller inom aktivt bolag. Ändringar här audit-loggas och används som override ovanpå systemets standardroller.
          </p>
        </section>
        <PermissionMatrix permissions={(permissions ?? []) as any} />
      </div>
    </AppShell>
  )
}
