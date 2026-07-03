export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { Field, inputClassName, selectClassName } from '@/components/ui/form-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePlatformAdmin } from '@/lib/auth/guards'
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

const statuses = ['new', 'contacted', 'demo_booked', 'offer_sent', 'won', 'lost', 'onboarding_started']

export default async function AdminDemoRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; industry?: string; assigned_to?: string; q?: string }> }) {
  const auth = await requirePlatformAdmin()
  const params = await searchParams

  let query = supabaseAdmin
    .from('demo_requests')
    .select('id, company_name, organization_number, contact_name, email, phone, industry, employee_count, status, next_contact_at, assigned_to, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (params.status) query = query.eq('status', params.status)
  if (params.industry) query = query.eq('industry', params.industry)
  if (params.assigned_to) query = query.eq('assigned_to', params.assigned_to)
  if (params.q) {
    const search = `%${params.q}%`
    query = query.or(`company_name.ilike.${search},email.ilike.${search},organization_number.ilike.${search}`)
  }

  const [{ data: requests }, { data: admins }, { data: readiness }] = await Promise.all([
    query,
    supabaseAdmin.from('profiles').select('id, email, full_name').in('platform_role', ['owner', 'platform_admin', 'support_admin']).order('email'),
    supabaseAdmin.from('coordiqo_demo_request_readiness_v').select('*').maybeSingle(),
  ])
  const rows = (requests ?? []) as DemoRequestRow[]
  const adminRows = (admins ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>
  const stats = readiness as {
    total_leads?: number
    new_leads?: number
    contacted_leads?: number
    demo_booked_leads?: number
    won_leads?: number
    lost_leads?: number
    onboarding_started_leads?: number
  } | null

  return (
    <AppShell auth={auth} title="Demo requests" subtitle="Sales-led leads, qualification, demo booking and onboarding start.">
      <div className="space-y-5">
        <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          {[
            ['Total', stats?.total_leads ?? rows.length],
            ['New', stats?.new_leads ?? 0],
            ['Contacted', stats?.contacted_leads ?? 0],
            ['Demo booked', stats?.demo_booked_leads ?? 0],
            ['Won', stats?.won_leads ?? 0],
            ['Lost', stats?.lost_leads ?? 0],
            ['Onboarding', stats?.onboarding_started_leads ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="coordiqo-card p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>
          ))}
        </section>

        <section className="coordiqo-card p-5">
          <form className="grid gap-3 md:grid-cols-[1fr_180px_180px_220px_auto]">
            <Field label="Search"><input name="q" defaultValue={params.q ?? ''} className={inputClassName} placeholder="Company, email or org number" /></Field>
            <Field label="Status">
              <select name="status" defaultValue={params.status ?? ''} className={selectClassName}>
                <option value="">All</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Industry"><input name="industry" defaultValue={params.industry ?? ''} className={inputClassName} /></Field>
            <Field label="Assigned">
              <select name="assigned_to" defaultValue={params.assigned_to ?? ''} className={selectClassName}>
                <option value="">All</option>
                {adminRows.map((admin) => <option key={admin.id} value={admin.id}>{admin.full_name ?? admin.email ?? admin.id}</option>)}
              </select>
            </Field>
            <div className="flex items-end"><button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Filter</button></div>
          </form>
        </section>

        <section className="coordiqo-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Org no</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Employees</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Next contact</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-950"><Link href={`/admin/demo-requests/${request.id}`}>{request.company_name}</Link></td>
                    <td className="px-4 py-3 text-slate-600">{request.organization_number ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{request.contact_name}</td>
                    <td className="px-4 py-3 text-slate-600">{request.email}</td>
                    <td className="px-4 py-3 text-slate-600">{request.phone ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{request.industry ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{request.employee_count ?? '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{request.next_contact_at ? new Date(request.next_contact_at).toLocaleDateString('sv-SE') : '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{adminRows.find((admin) => admin.id === request.assigned_to)?.email ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(request.created_at).toLocaleDateString('sv-SE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  )
}

