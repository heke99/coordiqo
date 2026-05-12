export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { archiveStaffAction, assignStaffCertificationAction, assignStaffSkillAction, removeStaffCertificationAction, removeStaffSkillAction, updateStaffAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params

  const [{ data: person }, { data: teams }, { data: resources }, { data: skills }, { data: certifications }, { data: staffSkills }, { data: staffCertifications }, { data: upcomingShifts }, { data: activeAbsences }, { data: availabilityTemplates }] = await Promise.all([
    supabaseAdmin.from('staff_profiles').select('*').eq('id', id).eq('company_id', auth.membership.companyId).is('archived_at', null).maybeSingle(),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('resource_assets').select('id, name, status').eq('company_id', auth.membership.companyId).eq('assigned_staff_id', id).is('archived_at', null).order('name'),
    supabaseAdmin.from('skills').select('id, name, category').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('name'),
    supabaseAdmin.from('certifications').select('id, name, category, requires_expiry').eq('company_id', auth.membership.companyId).eq('is_active', true).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_skills').select('id, skill_id, level, notes, skills(name, category)').eq('company_id', auth.membership.companyId).eq('staff_profile_id', id).is('archived_at', null).order('created_at', { ascending: false }),
    supabaseAdmin.from('staff_certifications').select('id, certification_id, status, certificate_number, expires_at, certifications(name, category)').eq('company_id', auth.membership.companyId).eq('staff_profile_id', id).is('archived_at', null).order('created_at', { ascending: false }),
    supabaseAdmin.from('shifts').select('id, title, starts_at, ends_at, status, capacity_minutes, remaining_minutes').eq('company_id', auth.membership.companyId).eq('staff_profile_id', id).is('archived_at', null).gte('starts_at', new Date().toISOString()).order('starts_at').limit(8),
    supabaseAdmin.from('absences').select('id, starts_at, ends_at, status, reason, absence_types(name)').eq('company_id', auth.membership.companyId).eq('staff_profile_id', id).is('archived_at', null).gte('ends_at', new Date().toISOString()).order('starts_at').limit(8),
    supabaseAdmin.from('availability_template_targets').select('id, availability_templates(id, name, target_type, status)').eq('company_id', auth.membership.companyId).eq('staff_profile_id', id).is('archived_at', null).limit(8),
  ])

  if (!person) notFound()

  return (
    <AppShell auth={auth} title={person.full_name} subtitle="Personalprofil, team, färdsätt och operativ status.">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <FormCard title="Redigera personalprofil">
          <form action={updateStaffAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={person.id} />
            <Field label="Namn"><input name="full_name" required defaultValue={person.full_name} className={inputClassName} /></Field>
            <Field label="E-post"><input name="email" type="email" defaultValue={person.email ?? ''} className={inputClassName} /></Field>
            <Field label="Telefon"><input name="phone" defaultValue={person.phone ?? ''} className={inputClassName} /></Field>
            <Field label="Anställnings-ID"><input name="employee_id" defaultValue={person.employee_id ?? ''} className={inputClassName} /></Field>
            <Field label="Titel"><input name="job_title" defaultValue={person.job_title ?? ''} className={inputClassName} /></Field>
            <Field label="Primärt team"><select name="primary_team_id" defaultValue={person.primary_team_id ?? ''} className={selectClassName}><option value="">Inget team</option>{teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
            <Field label="Personaltyp"><select name="staff_kind" defaultValue={person.staff_kind} className={selectClassName}><option value="staff">Personal</option><option value="contractor">Entreprenör</option><option value="manager">Chef</option><option value="planner">Planerare</option><option value="supervisor">Supervisor</option><option value="external">Extern</option></select></Field>
            <Field label="Anställningsform"><select name="employment_type" defaultValue={person.employment_type ?? 'unspecified'} className={selectClassName}><option value="unspecified">Ej specificerad</option><option value="full_time">Heltid</option><option value="part_time">Deltid</option><option value="hourly">Timanställd</option><option value="contractor">Konsult/entreprenör</option><option value="temporary">Vikarie/tillfällig</option></select></Field>
            <Field label="Färdsätt"><select name="transport_mode" defaultValue={person.transport_mode} className={selectClassName}><option value="car">Bil</option><option value="service_vehicle">Servicebil</option><option value="bike">Cykel</option><option value="walk">Gång</option><option value="public_transport">Kollektivtrafik</option><option value="none">Ej relevant</option></select></Field>
            <Field label="Status"><select name="status" defaultValue={person.status} className={selectClassName}><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></Field>
            <Field label="Startplats"><input name="start_address" defaultValue={person.start_address ?? ''} className={inputClassName} /></Field>
            <Field label="Slutplats"><input name="end_address" defaultValue={person.end_address ?? ''} className={inputClassName} /></Field>
            <div className="sm:col-span-2"><Field label="Noteringar"><textarea name="notes" defaultValue={person.notes ?? ''} className={textareaClassName} /></Field></div>
            <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Spara ändringar</button></div>
          </form>
        </FormCard>

        <div className="space-y-5">
          <section className="coordiqo-card p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-950">Status</h2><StatusBadge status={person.status} /></div><p className="mt-3 text-sm leading-6 text-slate-600">Arkivering är soft delete. Personens historik bevaras inför senare planerings- och auditflöden.</p><form action={archiveStaffAction} className="mt-4"><input type="hidden" name="id" value={person.id} /><button className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Arkivera personal</button></form></section>
          
          <FormCard title="Lägg till kompetens">
            <form action={assignStaffSkillAction} className="grid gap-4">
              <input type="hidden" name="staff_profile_id" value={person.id} />
              <Field label="Kompetens"><select name="skill_id" required className={selectClassName}><option value="">Välj kompetens</option>{skills?.map((skill: any) => <option key={skill.id} value={skill.id}>{skill.name} · {skill.category}</option>)}</select></Field>
              <Field label="Nivå"><select name="level" defaultValue="qualified" className={selectClassName}><option value="basic">Grund</option><option value="qualified">Behörig</option><option value="expert">Expert</option></select></Field>
              <Field label="Notering"><textarea name="notes" className={textareaClassName} /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Lägg till kompetens</button>
            </form>
          </FormCard>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Kompetenser</h2>
            <div className="mt-4 space-y-3">{staffSkills?.length ? staffSkills.map((row: any) => <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{row.skills?.name ?? 'Kompetens'}</p><p className="mt-1 text-sm text-slate-500">{row.level}</p></div><form action={removeStaffSkillAction}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="staff_profile_id" value={person.id} /><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Ta bort</button></form></div></div>) : <p className="text-sm text-slate-600">Inga kompetenser kopplade ännu.</p>}</div>
          </section>

          <FormCard title="Lägg till certifikat">
            <form action={assignStaffCertificationAction} className="grid gap-4">
              <input type="hidden" name="staff_profile_id" value={person.id} />
              <Field label="Certifikat"><select name="certification_id" required className={selectClassName}><option value="">Välj certifikat</option>{certifications?.map((cert: any) => <option key={cert.id} value={cert.id}>{cert.name} · {cert.category}</option>)}</select></Field>
              <Field label="Status"><select name="status" defaultValue="valid" className={selectClassName}><option value="valid">Giltigt</option><option value="pending">Väntar</option><option value="expired">Utgånget</option><option value="revoked">Spärrat</option></select></Field>
              <Field label="Certifikatnummer"><input name="certificate_number" className={inputClassName} /></Field>
              <Field label="Utfärdat"><input name="issued_at" type="date" className={inputClassName} /></Field>
              <Field label="Gäller till"><input name="expires_at" type="date" className={inputClassName} /></Field>
              <Field label="Notering"><textarea name="notes" className={textareaClassName} /></Field>
              <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Lägg till certifikat</button>
            </form>
          </FormCard>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Certifikat</h2>
            <div className="mt-4 space-y-3">{staffCertifications?.length ? staffCertifications.map((row: any) => <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{row.certifications?.name ?? 'Certifikat'}</p><p className="mt-1 text-sm text-slate-500">{row.status}{row.expires_at ? ` · gäller till ${row.expires_at}` : ''}</p></div><form action={removeStaffCertificationAction}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="staff_profile_id" value={person.id} /><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Ta bort</button></form></div></div>) : <p className="text-sm text-slate-600">Inga certifikat kopplade ännu.</p>}</div>
          </section>


          <section className="coordiqo-card p-5"><h2 className="text-lg font-semibold text-slate-950">Planeringsunderlag</h2><div className="mt-4 grid gap-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-950">Kommande pass</p><div className="mt-3 space-y-2">{upcomingShifts?.length ? upcomingShifts.map((shift: any) => <a key={shift.id} href={`/schedule/${shift.id}`} className="block rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{new Date(shift.starts_at).toLocaleString('sv-SE')} · {shift.title ?? 'Pass'} · kvar {shift.remaining_minutes ?? 0} min</a>) : <p className="text-sm text-slate-500">Inga kommande pass.</p>}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-950">Kommande frånvaro</p><div className="mt-3 space-y-2">{activeAbsences?.length ? activeAbsences.map((absence: any) => <a key={absence.id} href={`/absences/${absence.id}`} className="block rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{absence.absence_types?.name ?? 'Frånvaro'} · {new Date(absence.starts_at).toLocaleDateString('sv-SE')}</a>) : <p className="text-sm text-slate-500">Ingen kommande frånvaro.</p>}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-950">Tillgänglighetsmallar</p><div className="mt-3 space-y-2">{availabilityTemplates?.length ? availabilityTemplates.map((target: any) => <a key={target.id} href={`/availability/templates/${target.availability_templates?.id}`} className="block rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{target.availability_templates?.name ?? 'Mall'}</a>) : <p className="text-sm text-slate-500">Ingen mall kopplad.</p>}</div></div></div></section>

          <section className="coordiqo-card p-5"><h2 className="text-lg font-semibold text-slate-950">Tilldelade resurser</h2><div className="mt-4 space-y-3">{resources?.length ? resources.map((resource) => <div key={resource.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-950">{resource.name}</p><p className="mt-1 text-sm text-slate-500">{resource.status}</p></div>) : <p className="text-sm text-slate-600">Inga resurser är kopplade till personen ännu.</p>}</div></section>
        </div>
      </div>
    </AppShell>
  )
}
