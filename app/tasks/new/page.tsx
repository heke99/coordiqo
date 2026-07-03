export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { TaskForm } from '@/components/tasks/task-form'
import { FormCard } from '@/components/ui/form-card'
import { requireCompanyContext } from '@/lib/auth/guards'
import { resolveIndustryTerminology } from '@/lib/industry/registry'
import { createTaskAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewTaskPage() {
  const auth = await requireCompanyContext()
  const terminology = await resolveIndustryTerminology(auth.membership.companyId, auth.membership.industryType)

  const [{ data: taskTypes }, { data: entities }, { data: teams }, { data: staff }, { data: workOrders }] = await Promise.all([
    supabaseAdmin.from('task_types').select('id, name').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('name'),
    supabaseAdmin.from('entities').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name').limit(200),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('work_orders').select('id, title').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(100),
  ])

  return (
    <AppShell auth={auth} title={`Skapa ${terminology.task.toLowerCase()}`} subtitle={`Skapa ${terminology.task.toLowerCase()} med ${terminology.entity.toLowerCase()}, tidsfönster, team/person och instruktioner.`}>
      <FormCard title="Uppgifter" description={`Skapa ${terminology.task.toLowerCase()} som kan kopplas till ${terminology.entities.toLowerCase()}, team, ${terminology.staff.toLowerCase().replace('/', ' och ')} och smart planering.`}>
        <TaskForm action={createTaskAction} taskTypes={taskTypes ?? []} entities={entities ?? []} teams={teams ?? []} staff={staff ?? []} workOrders={workOrders ?? []} submitLabel={`Skapa ${terminology.task.toLowerCase()}`} industryType={auth.membership.industryType} terminology={terminology} />
      </FormCard>
    </AppShell>
  )
}
