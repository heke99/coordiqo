export const dynamic = 'force-dynamic'

import { AppShell } from '@/components/app/app-shell'
import { Field, FormCard, inputClassName, selectClassName, textareaClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { createCompanyAccessRequestAction, createCompanyWorkspaceAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function CompaniesSettingsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const { data: requests } = await supabaseAdmin
    .from('company_access_requests')
    .select('id, company_name, request_type, status, message, created_at')
    .eq('requester_user_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <AppShell auth={auth} title="Företag & miljöer" subtitle="Samma användare kan äga och hantera flera företag med samma e-postadress. Byt aktivt företag direkt i sidebaren.">
      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-5">
          <section className="coordiqo-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Dina åtkomster</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Företag kopplade till din användare</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Du kan skapa flera bolagsmiljöer under samma konto. Aktiv miljö styr all data i dashboard, objekt, personal och uppdrag.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {auth.memberships.map((membership) => (
                <div key={membership.membershipId} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">{membership.companyName}</p>
                      <p className="mt-1 text-sm text-slate-500">{membership.industryLabel} · {membership.operationalModelLabel} · {membership.companyRole}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {membership.companyId === auth.membership?.companyId ? <StatusBadge status="aktiv" /> : <StatusBadge status="tillgänglig" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <FormCard title="Skapa ny företagsmiljö" description="Använd detta när samma ägare ska hantera flera bolag eller separata verksamheter. Företaget skapas direkt med dig som företagsadmin.">
            <form action={createCompanyWorkspaceAction} className="grid gap-4 sm:grid-cols-2">
              <Field label="Företagsnamn"><input name="name" required className={inputClassName} placeholder="Ex. Nytt Fastighetsbolag AB" /></Field>
              <Field label="Bransch">
                <select name="industry_type" defaultValue="property" className={selectClassName}>
                  <option value="property">Fastighet och hyresvärd</option>
                  <option value="home_care">Hemtjänst</option>
                  <option value="cleaning">Städ</option>
                  <option value="field_service">Tekniker och service</option>
                  <option value="healthcare">Vård och hemsjukvård</option>
                  <option value="construction">Bygg</option>
                  <option value="parking">Parkeringsövervakning</option>
                  <option value="other">Annan verksamhet</option>
                </select>
              </Field>
              <Field label="Operativ modell">
                <select name="operational_model" defaultValue="case_based" className={selectClassName}>
                  <option value="case_based">Ärendebaserad</option>
                  <option value="object_based">Objektbaserad</option>
                  <option value="route_based">Ruttbaserad</option>
                  <option value="area_based">Områdesbaserad</option>
                  <option value="team_based">Teambaserad</option>
                  <option value="calendar_based">Kalenderbaserad</option>
                </select>
              </Field>
              <div className="sm:col-span-2"><button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Skapa och gå in i företaget</button></div>
            </form>
          </FormCard>
        </div>

        <div className="space-y-5">
          <FormCard title="Ansök om åtkomst till befintligt företag" description="Detta är rätt modell när någon annan redan äger miljön. Begäran kan senare godkännas av superadmin eller företagets admin.">
            <form action={createCompanyAccessRequestAction} className="grid gap-4">
              <Field label="Företagsnamn"><input name="company_name" required className={inputClassName} placeholder="Bolaget du vill ansluta till" /></Field>
              <Field label="Typ"><select name="request_type" defaultValue="join_existing" className={selectClassName}><option value="join_existing">Anslut till befintligt företag</option><option value="new_company_review">Nytt företag som kräver granskning</option></select></Field>
              <Field label="Meddelande"><textarea name="message" className={textareaClassName} placeholder="Förklara varför åtkomst behövs" /></Field>
              <button className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800">Skicka begäran</button>
            </form>
          </FormCard>

          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Dina åtkomstbegäranden</h2>
            <div className="mt-4 space-y-3">
              {requests?.length ? requests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3"><p className="font-semibold text-slate-950">{request.company_name}</p><StatusBadge status={request.status} /></div>
                  <p className="mt-1 text-sm text-slate-500">{request.request_type} · {new Date(request.created_at).toLocaleString('sv-SE')}</p>
                  {request.message ? <p className="mt-2 text-sm text-slate-600">{request.message}</p> : null}
                </div>
              )) : <p className="text-sm text-slate-600">Inga begäranden ännu.</p>}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
