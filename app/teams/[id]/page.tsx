export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { archiveTeamAction, updateTeamAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const { id } = await params

  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id, name, code, description, status, created_at')
    .eq('id', id)
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .maybeSingle()

  if (!team) notFound()

  const { data: members } = await supabaseAdmin
    .from('staff_profiles')
    .select('id, full_name, job_title, status')
    .eq('company_id', auth.membership.companyId)
    .eq('primary_team_id', team.id)
    .is('archived_at', null)
    .order('full_name')

  return (
    <AppShell auth={auth} title={team.name} subtitle="Teamdetaljer, medlemmar och arkivering.">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <FormCard title="Redigera team">
          <form action={updateTeamAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={team.id} />
            <Field label="Namn"><input name="name" defaultValue={team.name} required className={inputClassName} /></Field>
            <Field label="Kod"><input name="code" defaultValue={team.code ?? ''} className={inputClassName} /></Field>
            <Field label="Status"><select name="status" defaultValue={team.status} className={selectClassName}><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></Field>
            <div className="sm:col-span-2"><Field label="Beskrivning"><textarea name="description" defaultValue={team.description ?? ''} className={textareaClassName} /></Field></div>
            <div className="flex flex-wrap gap-3 sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Spara ändringar</button></div>
          </form>
        </FormCard>

        <div className="space-y-5">
          <section className="coordiqo-card p-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-950">Status</h2><StatusBadge status={team.status} /></div>
            <p className="mt-3 text-sm leading-6 text-slate-600">Arkivering är soft delete. Teamet tas bort från aktiva listor men historik bevaras.</p>
            <form action={archiveTeamAction} className="mt-4">
              <input type="hidden" name="id" value={team.id} />
              <button className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Arkivera team</button>
            </form>
          </section>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Medlemmar</h2>
            <div className="mt-4 space-y-3">
              {members?.length ? members.map((member) => (
                <div key={member.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-950">{member.full_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{member.job_title ?? 'Ingen titel'} · {member.status}</p>
                </div>
              )) : <p className="text-sm text-slate-600">Inga personalprofiler är kopplade till teamet ännu.</p>}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
