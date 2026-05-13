export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { createResourceAction, createResourceTypeAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewResourcePage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const [{ data: types }, { data: staff }, { data: teams }] = await Promise.all([
    supabaseAdmin.from('resource_types').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
  ])

  return (
    <AppShell auth={auth} title="Skapa resurs" subtitle="Registrera en resurs som kan planeras, kvitteras och följas upp i historik." actions={<Link href="/resources" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Alla resurser</Link>}>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.65fr]">
        <FormCard title="Resursuppgifter" description="Håll det enkelt: namn, typ, status, standardplats och om resursen måste lämnas tillbaka.">
          <form action={createResourceAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Namn"><input name="name" required className={inputClassName} placeholder="Nyckel 15, Bil 3, Cykel 2, Borrmaskin A" /></Field>
            <Field label="Resurstyp"><select name="resource_type_id" className={selectClassName}><option value="">Välj typ</option>{types?.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field>
            <Field label="Asset tag / ID"><input name="asset_tag" className={inputClassName} placeholder="KEY-015, CAR-003" /></Field>
            <Field label="Status"><select name="status" defaultValue="available" className={selectClassName}><option value="available">Tillgänglig</option><option value="assigned">Tilldelad</option><option value="maintenance">Underhåll</option><option value="inactive">Inaktiv</option></select></Field>
            <Field label="Standardansvarig personal"><select name="assigned_staff_id" className={selectClassName}><option value="">Ingen person</option>{staff?.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field>
            <Field label="Standardteam"><select name="assigned_team_id" className={selectClassName}><option value="">Inget team</option>{teams?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field>
            <Field label="Standardplats"><input name="location_label" className={inputClassName} placeholder="Kontor, nyckelskåp A, garage" /></Field>
            <Field label="Återlämning"><select name="requires_return" defaultValue="on" className={selectClassName}><option value="on">Personal ska markera avlämnad</option><option value="off">Avlämning krävs inte</option></select></Field>
            <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input name="allow_overlapping" type="checkbox" className="mt-1" />
                <span><b>Tillåt delad/dubbel användning</b><br />Använd endast för resurser som kan delas samtidigt. Nycklar, bilar och maskiner bör normalt inte dubbelbokas.</span>
              </label>
            </div>
            <div className="sm:col-span-2"><Field label="Noteringar"><textarea name="notes" className={textareaClassName} placeholder="Intern info om var resursen finns, hur den används eller särskilda regler." /></Field></div>
            <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa resurs</button></div>
          </form>
        </FormCard>

        <section className="space-y-5">
          <FormCard title="Skapa ny resurstyp" description="Resurstyper är branschneutrala. Skapa egna typer om standardtyperna inte räcker.">
            <form action={createResourceTypeAction} className="grid gap-4">
              <Field label="Namn"><input name="name" required className={inputClassName} placeholder="Ex. Lift, servicebil, städvagn" /></Field>
              <Field label="Kod"><input name="code" className={inputClassName} placeholder="Valfritt" /></Field>
              <Field label="Beskrivning"><textarea name="description" className={textareaClassName} /></Field>
              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">Skapa typ</button>
            </form>
          </FormCard>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Exempel</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Nyckel', 'Bil', 'Cykel', 'Verktyg', 'Maskin', 'Passerkort', 'Medicinsk utrustning', 'Annat'].map((label) => <span key={label} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{label}</span>)}
            </div>
          </section>
        </section>
      </div>
    </AppShell>
  )
}
