export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { ShiftCreateForm } from '@/components/schedule/shift-create-form'
import { FormCard } from '@/components/ui/form-card'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewShiftPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const [{ data: staff }, { data: teams }] = await Promise.all([
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
  ])

  return (
    <AppShell auth={auth} title="Nytt pass" subtitle="Skapa ett verkligt planeringsunderlag för personal eller team.">
      <FormCard title="Passinformation" description="Kapacitet räknas från arbetstid minus rast och buffer. Fel visas direkt i formuläret utan att du tappar ifyllda värden.">
        <ShiftCreateForm staff={staff ?? []} teams={teams ?? []} />
      </FormCard>
    </AppShell>
  )
}
