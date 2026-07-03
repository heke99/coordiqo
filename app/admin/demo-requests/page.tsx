export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, selectClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePlatformAdmin } from '@/lib/auth/guards'
import { getIndustryRegistry } from '@/lib/industry/registry'
import { DEMO_STATUS_ORDER, demoStatusLabel } from '@/lib/sales/demo-config'
import { supabaseAdmin } from '@/lib/supabase/admin'

type DemoRequestRow = {
  id: string
  company_name: string
  organization_number: string | null
  contact_name: string
  email: string
  phone: string | null
  industry: string | null
  employee_count: string | null
  status: string
  next_contact_at: string | null
  assigned_to: string | null
  created_at: string
}

export default async function AdminDemoRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; industry?: string; assigned_to?: string; q?: string; overdue?: string }> }) {
  const auth = await requirePlatformAdmin()
  const params = await searchParams

  let query = supabaseAdmin
    .from('demo_requests')
    .select('id, company_name, organization_number, contact_name, email, phone, industry, employee_count, status, next_contact_at, assigned_to, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (params.status) query = query.eq('status', params.status)
  else query = query.neq('status', 'archived')
  if (params.industry) query = query.eq('industry', params.industry)
  if (params.assigned_to) query = query.eq('assigned_to', params.assigned_to)
  if (params.overdue === '1') query = query.lt('next_contact_at', new Date().toISOString())
  if (params.q) {
    const search = `%${params.q}%`
    query = query.or(`company_name.ilike.${search},email.ilike.${search},organization_number.ilike.${search}`)
  }

  const [{ data: requests }, { data: admins }, { data: readiness }, registry] = await Promise.all([
    query,
    supabaseAdmin.from('profiles').select('id, email, full_name').in('platform_role', ['owner', 'platform_admin', 'support_admin']).order('email'),
    supabaseAdmin.from('coordiqo_demo_request_readiness_v').select('*').maybeSingle(),
    getIndustryRegistry(),
  ])
  const rows = (requests ?? []) as DemoRequestRow[]
  const adminRows = (admins ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>
  const stats = (readiness ?? {}) as Record<string, number>
  const industryName = (code: string | null) => registry.find((profile) => profile.code === code)?.nameSv ?? code ?? '—'

  const statCards: Array<[string, number]> = [
    ['Totalt', stats.total_leads ?? rows.length],
    ['Nya', stats.new_leads ?? 0],
    ['Kontaktade', stats.contacted_leads ?? 0],
    ['Kvalificerade', stats.qualified_leads ?? 0],
    ['Demo bokad', stats.demo_booked_leads ?? 0],
    ['Bolag skapade', stats.company_created_leads ?? 0],
    ['Vunna', stats.won_leads ?? 0],
    ['Förlorade', stats.lost_leads ?? 0],
  ]

  return (
    <AppShell auth={auth} title="Demoansökningar" subtitle="Leads från webbplatsen: kvalificering, demobokning, pilot och bolagsskapande.">
      <div className="space-y-5">
        <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          {statCards.map(([label, value]) => (
            <div key={label} className="coordiqo-card p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>
          ))}
        </section>

        <section className="coordiqo-card p-5">
          <form className="grid gap-3 md:grid-cols-[1fr_170px_190px_200px_150px_auto]">
            <Field label="Sök"><input name="q" defaultValue={params.q ?? ''} className={inputClassName} placeholder="Företag, e-post eller org.nr" /></Field>
            <Field label="Status">
              <select name="status" defaultValue={params.status ?? ''} className={selectClassName}>
                <option value="">Alla (utom arkiverade)</option>
                {DEMO_STATUS_ORDER.map((status) => <option key={status} value={status}>{demoStatusLabel(status)}</option>)}
              </select>
            </Field>
            <Field label="Bransch">
              <select name="industry" defaultValue={params.industry ?? ''} className={selectClassName}>
                <option value="">Alla</option>
                {registry.map((profile) => <option key={profile.code} value={profile.code}>{profile.nameSv}</option>)}
              </select>
            </Field>
            <Field label="Ansvarig">
              <select name="assigned_to" defaultValue={params.assigned_to ?? ''} className={selectClassName}>
                <option value="">Alla</option>
                {adminRows.map((admin) => <option key={admin.id} value={admin.id}>{admin.full_name ?? admin.email ?? admin.id}</option>)}
              </select>
            </Field>
            <Field label="Uppföljning">
              <select name="overdue" defaultValue={params.overdue ?? ''} className={selectClassName}>
                <option value="">Alla</option>
                <option value="1">Försenad kontakt</option>
              </select>
            </Field>
            <div className="flex items-end"><button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Filtrera</button></div>
          </form>
        </section>

        <section className="coordiqo-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Företag</th>
                  <th className="px-4 py-3">Org.nr</th>
                  <th className="px-4 py-3">Kontakt</th>
                  <th className="px-4 py-3">E-post</th>
                  <th className="px-4 py-3">Bransch</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Nästa kontakt</th>
                  <th className="px-4 py-3">Ansvarig</th>
                  <th className="px-4 py-3">Skapad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((request) => {
                  const overdue = request.next_contact_at && new Date(request.next_contact_at) < new Date() && !['won', 'lost', 'archived'].includes(request.status)
                  return (
                    <tr key={request.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-950"><Link href={`/admin/demo-requests/${request.id}`}>{request.company_name}</Link></td>
                      <td className="px-4 py-3 text-slate-600">{request.organization_number ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{request.contact_name}</td>
                      <td className="px-4 py-3 text-slate-600">{request.email}</td>
                      <td className="px-4 py-3 text-slate-600">{industryName(request.industry)}</td>
                      <td className="px-4 py-3"><StatusBadge status={demoStatusLabel(request.status)} tone={request.status === 'won' ? 'success' : request.status === 'lost' ? 'danger' : request.status === 'new' ? 'warning' : 'neutral'} /></td>
                      <td className={`px-4 py-3 ${overdue ? 'font-semibold text-red-600' : 'text-slate-600'}`}>{request.next_contact_at ? new Date(request.next_contact_at).toLocaleDateString('sv-SE') : '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{adminRows.find((admin) => admin.id === request.assigned_to)?.full_name ?? adminRows.find((admin) => admin.id === request.assigned_to)?.email ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(request.created_at).toLocaleDateString('sv-SE')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!rows.length && <p className="px-4 py-8 text-center text-sm text-slate-600">Inga leads matchar filtren.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
