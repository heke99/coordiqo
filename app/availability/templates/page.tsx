export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireCompanyContext } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function AvailabilityTemplatesPage() {
  const auth = await requireCompanyContext()
  const { data: templates, error } = await supabaseAdmin.from('availability_templates').select('id, name, description, target_type, status, created_at').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false })
  return <AppShell auth={auth} title="Tillgänglighetsmallar" subtitle="Personalmallar och teammallar som skapar verkliga pass för datumintervall." actions={<Link href="/availability/templates/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Ny mall</Link>}><div className="space-y-5">{error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}{templates?.length ? <div className="grid gap-3 sm:grid-cols-2">{templates.map((template: any) => <Link key={template.id} href={`/availability/templates/${template.id}`} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{template.name}</p><p className="mt-1 text-sm text-slate-500">{template.description ?? 'Ingen beskrivning'}</p><p className="mt-2 text-xs text-slate-400">Måltyp: {template.target_type}</p></div><StatusBadge status={template.status} /></div></Link>)}</div> : <EmptyState eyebrow="Batch 7" title="Inga mallar ännu" description="Skapa återkommande schema/tillgänglighet för personal eller team och applicera på datumintervall." action={<Link href="/availability/templates/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Skapa mall</Link>} />}</div></AppShell>
}
