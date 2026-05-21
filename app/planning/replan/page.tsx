export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName } from '@/components/ui/form-card'
import { requireAuth } from '@/lib/auth/session'
import { createPlanningRunAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function ReplanPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: staff }, { data: teams }, { data: conflicts }, { data: absences }] = await Promise.all([
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).eq('status', 'active').is('archived_at', null).order('full_name'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('planning_conflicts').select('id, conflict_type, severity, message, tasks(title), staff_profiles(full_name)').eq('company_id', auth.membership.companyId).eq('status', 'open').order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('absences').select('id, start_at, end_at, absence_types(name), staff_profiles(full_name)').eq('company_id', auth.membership.companyId).in('status', ['approved', 'active']).order('start_at', { ascending: true }).limit(10),
  ])

  return (
    <AppShell auth={auth} title="Omplanering" subtitle="Skapa ett nytt planeringsutkast när personal blir sjuk, resurser saknas eller dagens plan behöver justeras." actions={<Link href="/planning" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">Till planering</Link>}>
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <FormCard title="Starta replan-körning" description="MVP-versionen skapar ett nytt planeringsutkast med fokus på vald period/team/person. AI-optimering kopplas senare ovanpå samma flöde.">
          <form action={createPlanningRunAction} className="grid gap-4">
            <input type="hidden" name="name" value={`Omplanering ${today}`} />
            <input type="hidden" name="unscheduled_only" value="false" />
            <Field label="Från datum"><input name="date_from" type="date" required defaultValue={today} className={inputClassName} /></Field>
            <Field label="Till datum"><input name="date_to" type="date" required defaultValue={today} className={inputClassName} /></Field>
            <Field label="Berörd personal"><select name="staff_profile_id" className={selectClassName}><option value="">All personal</option>{staff?.map((person: any) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
            <Field label="Team"><select name="team_id" className={selectClassName}><option value="">Alla team</option>{teams?.map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
            <Field label="Orsak"><input name="area_label" placeholder="Ex. sjuk personal, resurs saknas, akut uppdrag" className={inputClassName} /></Field>
            <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa replan-utkast</button>
          </form>
        </FormCard>

        <section className="space-y-5">
          <div className="coordiqo-card p-5"><h2 className="text-lg font-semibold text-slate-950">Aktiva frånvaror</h2><div className="mt-4 space-y-3">{absences?.length ? absences.map((absence: any) => <div key={absence.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-semibold text-slate-950">{absence.staff_profiles?.full_name ?? 'Personal'} · {absence.absence_types?.name ?? 'Frånvaro'}</p><p className="mt-1 text-xs text-slate-500">{new Date(absence.start_at).toLocaleString('sv-SE')} – {new Date(absence.end_at).toLocaleString('sv-SE')}</p></div>) : <p className="text-sm text-slate-600">Ingen aktiv frånvaro hittades.</p>}</div></div>
          <div className="coordiqo-card p-5"><h2 className="text-lg font-semibold text-slate-950">Öppna konflikter</h2><div className="mt-4 space-y-3">{conflicts?.length ? conflicts.map((conflict: any) => <div key={conflict.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="font-semibold text-amber-950">{conflict.message}</p><p className="mt-1 text-xs text-amber-800">{conflict.tasks?.title ?? 'Uppdrag'} · {conflict.staff_profiles?.full_name ?? 'ingen personal'} · {conflict.conflict_type}</p></div>) : <p className="text-sm text-slate-600">Inga öppna konflikter.</p>}</div></div>
        </section>
      </div>
    </AppShell>
  )
}
