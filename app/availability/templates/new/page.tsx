export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { createAvailabilityTemplateAction } from '@/lib/platform/actions'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function NewAvailabilityTemplatePage() {
  const auth = await requireCompanyContext()
  const [{ data: staff }, { data: teams }] = await Promise.all([
    supabaseAdmin.from('staff_profiles').select('id, full_name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('full_name'),
    supabaseAdmin.from('teams').select('id, name').eq('company_id', auth.membership.companyId).is('archived_at', null).order('name'),
  ])
  return <AppShell auth={auth} title="Ny tillgänglighetsmall" subtitle="Skapa en personal- eller teammall som senare appliceras till riktiga pass."><FormCard title="Mall"><form action={createAvailabilityTemplateAction} className="grid gap-4 sm:grid-cols-2"><Field label="Namn"><input name="name" required className={inputClassName} placeholder="Team Syd vardag, Anna dagpass..." /></Field><Field label="Måltyp"><select name="target_type" defaultValue="staff" className={selectClassName}><option value="staff">Personal</option><option value="team">Team</option><option value="mixed">Mixad</option></select></Field><Field label="Personal"><select name="staff_profile_id" className={selectClassName}><option value="">Ingen personal direkt</option>{staff?.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field><Field label="Team"><select name="team_id" className={selectClassName}><option value="">Inget team direkt</option>{teams?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><Field label="Giltig från"><input name="valid_from" type="date" className={inputClassName} /></Field><Field label="Giltig till"><input name="valid_to" type="date" className={inputClassName} /></Field><Field label="Status"><select name="status" defaultValue="active" className={selectClassName}><option value="active">Aktiv</option><option value="draft">Utkast</option></select></Field><div className="sm:col-span-2"><Field label="Beskrivning"><textarea name="description" className={textareaClassName} /></Field></div><div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa mall</button></div></form></FormCard></AppShell>
}
