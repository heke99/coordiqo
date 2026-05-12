export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { createAbsenceAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewAbsencePage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const [{ data: staff }, { data: types }] = await Promise.all([
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('absence_types').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
  ])
  return <AppShell auth={auth} title="Ny frånvaro" subtitle="Frånvaro blockerar planering och skapar konflikt om den överlappar pass."><FormCard title="Frånvaro"><form action={createAbsenceAction} className="grid gap-4 sm:grid-cols-2"><Field label="Personal"><select name="staff_profile_id" required className={selectClassName}><option value="">Välj personal</option>{staff?.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field><Field label="Typ"><select name="absence_type_id" className={selectClassName}><option value="">Välj typ</option>{types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><Field label="Start"><input name="starts_at" type="datetime-local" required className={inputClassName} /></Field><Field label="Slut"><input name="ends_at" type="datetime-local" required className={inputClassName} /></Field><Field label="Heldag"><select name="is_all_day" defaultValue="false" className={selectClassName}><option value="false">Nej</option><option value="true">Ja</option></select></Field><Field label="Status"><select name="status" defaultValue="approved" className={selectClassName}><option value="requested">Begärd</option><option value="approved">Godkänd</option><option value="active">Aktiv</option></select></Field><Field label="Påverkar planering"><select name="affects_planning" defaultValue="true" className={selectClassName}><option value="true">Ja</option><option value="false">Nej</option></select></Field><div className="sm:col-span-2"><Field label="Anledning/notering"><textarea name="reason" className={textareaClassName} /></Field></div><div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa frånvaro</button></div></form></FormCard></AppShell>
}
