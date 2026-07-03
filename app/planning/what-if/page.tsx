export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName } from '@/components/ui/form-card'
import { requireCompanyContext } from '@/lib/auth/guards'
import { createPlanningRunAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function WhatIfPage() {
  const auth = await requireCompanyContext()
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = tomorrowDate.toISOString().slice(0, 10)

  const [{ data: staff }, { data: teams }, { data: resources }] = await Promise.all([
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).eq('status', 'active').is('archived_at', null).order('full_name'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('resource_assets').select('id, name, status').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name').limit(100),
  ])

  return (
    <AppShell auth={auth} title="What-if" subtitle="Analysera påverkan innan du ändrar verklig planering. Första versionen skapar ett draft-underlag, senare kopplas AI-förklaringar på.">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <FormCard title="Simulera scenario" description="Välj scenario och skapa ett utkast som visar kapacitet, konflikter och möjliga tilldelningar utan att publicera direkt.">
          <form action={createPlanningRunAction} className="grid gap-4">
            <input type="hidden" name="unscheduled_only" value="false" />
            <input type="hidden" name="source_type" value="what_if" />
            <Field label="Scenarionamn"><input name="name" defaultValue={`What-if ${tomorrow}`} className={inputClassName} /></Field>
            <div className="grid gap-4 md:grid-cols-2"><Field label="Från datum"><input name="date_from" type="date" required defaultValue={tomorrow} className={inputClassName} /></Field><Field label="Till datum"><input name="date_to" type="date" required defaultValue={tomorrow} className={inputClassName} /></Field></div>
            <Field label="Scenario"><select name="area_label" className={selectClassName}><option value="Personal sjuk">Personal sjuk</option><option value="Resurs saknas">Resurs saknas</option><option value="Akut uppdrag tillkommer">Akut uppdrag tillkommer</option><option value="Team får extra uppdrag">Team får extra uppdrag</option><option value="Kapacitet minskar">Kapacitet minskar</option></select></Field>
            <Field label="Personal"><select name="staff_profile_id" className={selectClassName}><option value="">Ingen specifik personal</option>{staff?.map((person: any) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
            <Field label="Team"><select name="team_id" className={selectClassName}><option value="">Alla team</option>{teams?.map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
            <Field label="Låsta tilldelningar"><select name="include_locked_assignments" defaultValue="true" className={selectClassName}><option value="true">Ta hänsyn till låsta tilldelningar</option><option value="false">Ignorera låsta tilldelningar i scenariot</option></select></Field>
            <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa what-if-utkast</button>
          </form>
        </FormCard>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Snabböversikt resurser</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Använd detta när scenariot handlar om bil, nyckel, cykel eller annan resurs som inte är tillgänglig.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {resources?.length ? resources.slice(0, 12).map((resource: any) => <div key={resource.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-semibold text-slate-950">{resource.name}</p><p className="mt-1 text-xs text-slate-500">{resource.status}</p></div>) : <p className="text-sm text-slate-600">Inga resurser hittades.</p>}
          </div>
          <Link href="/resources" className="mt-4 inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Hantera resurser</Link>
        </section>
      </div>
    </AppShell>
  )
}
