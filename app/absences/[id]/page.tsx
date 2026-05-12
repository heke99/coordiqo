export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { archiveAbsenceAction, updateAbsenceAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

function localDateTime(value: string) { return new Date(value).toISOString().slice(0, 16) }

export default async function AbsenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params
  const [{ data: absence }, { data: staff }, { data: types }] = await Promise.all([
    supabaseAdmin.from('absences').select('*').eq('id', id).eq('company_id', auth.membership.companyId).is('archived_at', null).maybeSingle(),
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('absence_types').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
  ])
  if (!absence) notFound()
  return <AppShell auth={auth} title="Frånvaro" subtitle="Redigera frånvaro och hur den påverkar planering."><div className="grid gap-5 lg:grid-cols-[1fr_0.6fr]"><FormCard title="Redigera frånvaro"><form action={updateAbsenceAction} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="id" value={absence.id} /><Field label="Personal"><select name="staff_profile_id" defaultValue={absence.staff_profile_id} required className={selectClassName}>{staff?.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field><Field label="Typ"><select name="absence_type_id" defaultValue={absence.absence_type_id ?? ''} className={selectClassName}><option value="">Välj typ</option>{types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><Field label="Start"><input name="starts_at" type="datetime-local" defaultValue={localDateTime(absence.starts_at)} required className={inputClassName} /></Field><Field label="Slut"><input name="ends_at" type="datetime-local" defaultValue={localDateTime(absence.ends_at)} required className={inputClassName} /></Field><Field label="Heldag"><select name="is_all_day" defaultValue={absence.is_all_day ? 'true' : 'false'} className={selectClassName}><option value="false">Nej</option><option value="true">Ja</option></select></Field><Field label="Status"><select name="status" defaultValue={absence.status} className={selectClassName}><option value="requested">Begärd</option><option value="approved">Godkänd</option><option value="active">Aktiv</option><option value="completed">Klar</option><option value="cancelled">Avbokad</option></select></Field><Field label="Påverkar planering"><select name="affects_planning" defaultValue={absence.affects_planning ? 'true' : 'false'} className={selectClassName}><option value="true">Ja</option><option value="false">Nej</option></select></Field><div className="sm:col-span-2"><Field label="Anledning/notering"><textarea name="reason" defaultValue={absence.reason ?? ''} className={textareaClassName} /></Field></div><div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Spara frånvaro</button></div></form></FormCard><section className="coordiqo-card p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-950">Status</h2><StatusBadge status={absence.status} /></div><p className="mt-3 text-sm text-slate-600">Frånvaro som påverkar planering används som hård blockering i framtida planeringsmotor.</p><form action={archiveAbsenceAction} className="mt-4"><input type="hidden" name="id" value={absence.id} /><button className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Arkivera frånvaro</button></form></section></div></AppShell>
}
