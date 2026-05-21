export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { COMPANY_ROLE_LABELS, isPlatformAdminRole, type CompanyRole } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { disableCompanyMembershipAction, updateCompanyGovernanceAction, updateCompanyMembershipAction } from '@/lib/platform/actions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AdminCompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!isPlatformAdminRole(auth.platformRole)) redirect('/dashboard')
  const { id } = await params

  const [companyRes, membersRes, invitesRes, auditRes, statsRes] = await Promise.all([
    supabaseAdmin.from('companies').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('company_memberships').select('id, user_id, role, status, is_default, created_at, disabled_at, disabled_reason').eq('company_id', id).order('created_at', { ascending: false }),
    supabaseAdmin.from('company_invitations').select('id, email, full_name, role, status, email_delivery_status, created_at, expires_at').eq('company_id', id).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('audit_logs').select('id, action, entity_type, entity_id, created_at').eq('company_id', id).order('created_at', { ascending: false }).limit(10),
    Promise.all([
      supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true }).eq('company_id', id),
      supabaseAdmin.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('company_id', id),
      supabaseAdmin.from('resources').select('id', { count: 'exact', head: true }).eq('company_id', id),
      supabaseAdmin.from('planning_runs').select('id', { count: 'exact', head: true }).eq('company_id', id),
      supabaseAdmin.from('entity_documents').select('id', { count: 'exact', head: true }).eq('company_id', id),
    ]),
  ])

  const company = companyRes.data
  if (!company) notFound()
  const stats = [
    { label: 'Uppdrag', value: statsRes[0].count ?? 0 },
    { label: 'Personal', value: statsRes[1].count ?? 0 },
    { label: 'Resurser', value: statsRes[2].count ?? 0 },
    { label: 'Planeringskörningar', value: statsRes[3].count ?? 0 },
    { label: 'Dokument', value: statsRes[4].count ?? 0 },
  ]

  const roleOptions = Object.keys(COMPANY_ROLE_LABELS) as CompanyRole[]
  const lifecycle = company.lifecycle_status ?? (company.status === 'active' ? 'active' : 'paused')

  return (
    <AppShell auth={auth} title={company.name} subtitle="Superadminvy för bolagsstatus, användare, inbjudningar, audit och framtida faktureringsunderlag." actions={<Link href="/admin/companies" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">Till bolag</Link>}>
      <div className="space-y-5">
        <section className="coordiqo-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Bolagsstyrning</h2>
              <p className="mt-1 text-sm text-slate-500">{company.slug ?? 'slug saknas'} · {company.industry_type ?? 'bransch saknas'} · {company.operational_model ?? 'modell saknas'}</p>
            </div>
            <div className="flex gap-2"><StatusBadge status={lifecycle} /><StatusBadge status={company.status} /></div>
          </div>
          <form action={updateCompanyGovernanceAction} className="mt-5 grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <input type="hidden" name="company_id" value={company.id} />
            <select name="lifecycle_status" defaultValue={lifecycle} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="pending_approval">Väntar godkännande</option>
              <option value="active">Aktiv</option>
              <option value="paused">Pausad</option>
              <option value="rejected">Nekad</option>
              <option value="archived">Arkiverad</option>
            </select>
            <input name="approval_note" defaultValue={company.approval_note ?? ''} placeholder="Intern kommentar / orsak" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Spara</button>
          </form>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat) => <div key={stat.label} className="coordiqo-card p-5"><p className="text-sm text-slate-500">{stat.label}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{stat.value}</p></div>)}
        </section>

        <section className="coordiqo-card p-5">
          <h2 className="text-lg font-semibold text-slate-950">Användare och medlemskap</h2>
          <div className="mt-4 space-y-3">
            {(membersRes.data ?? []).map((member: any) => (
              <div key={member.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{member.user_id}</p>
                    <p className="mt-1 text-xs text-slate-500">{member.user_id} · skapad {new Date(member.created_at).toLocaleDateString('sv-SE')}</p>
                    {member.disabled_reason ? <p className="mt-2 text-xs text-red-600">Avstängd: {member.disabled_reason}</p> : null}
                  </div>
                  <StatusBadge status={member.status} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                  <form action={updateCompanyMembershipAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="membership_id" value={member.id} />
                    <input type="hidden" name="company_id" value={company.id} />
                    <select name="role" defaultValue={member.role} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      {roleOptions.map((role) => <option key={role} value={role}>{COMPANY_ROLE_LABELS[role]}</option>)}
                    </select>
                    <select name="status" defaultValue={member.status ?? 'active'} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <option value="active">Aktiv</option><option value="disabled">Avstängd</option><option value="invited">Inbjuden</option>
                    </select>
                    <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Spara roll/status</button>
                  </form>
                  <form action={disableCompanyMembershipAction} className="flex gap-2">
                    <input type="hidden" name="membership_id" value={member.id} />
                    <input type="hidden" name="company_id" value={company.id} />
                    <input name="reason" placeholder="Orsak" className="min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    <button className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white">Ta bort</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="coordiqo-card p-5"><h2 className="text-lg font-semibold text-slate-950">Senaste inbjudningar</h2><div className="mt-4 space-y-3">{(invitesRes.data ?? []).map((invite: any) => <div key={invite.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-semibold text-slate-950">{invite.email}</p><p className="mt-1 text-xs text-slate-500">{invite.role} · {invite.email_delivery_status ?? 'okänd emailstatus'}</p><StatusBadge status={invite.status} /></div>)}</div></div>
          <div className="coordiqo-card p-5"><h2 className="text-lg font-semibold text-slate-950">Senaste audit</h2><div className="mt-4 divide-y divide-slate-100">{(auditRes.data ?? []).map((event: any) => <div key={event.id} className="py-3"><p className="text-sm font-semibold text-slate-950">{event.action} · {event.entity_type}</p><p className="mt-1 text-xs text-slate-500">{new Date(event.created_at).toLocaleString('sv-SE')}</p></div>)}</div></div>
        </section>
      </div>
    </AppShell>
  )
}
