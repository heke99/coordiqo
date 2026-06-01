export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { undoImportRunAction } from '@/lib/import/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ImportInputPanel } from './import-input-panel'

type ImportRunRow = {
  id: string
  import_type: string
  source_name: string | null
  status: string
  rows_total: number
  rows_imported: number
  rows_failed: number
  created_at: string
}

type ImportItemRow = {
  id: string
  import_run_id: string
  row_number: number | null
  status: string
  error_message: string | null
}

const targets = [
  { value: 'staff', label: 'Personal' },
  { value: 'resources', label: 'Resurser' },
  { value: 'entities', label: 'Kunder/objekt' },
  { value: 'tasks', label: 'Uppdrag' },
  { value: 'projects', label: 'Projekt' },
]

export default async function ImportPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const [{ data: runs }, { data: items }, { data: templates }] = await Promise.all([
    supabaseAdmin.from('import_runs').select('id, import_type, source_name, status, rows_total, rows_imported, rows_failed, created_at').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('import_run_items').select('id, import_run_id, row_number, status, error_message').eq('company_id', auth.membership.companyId).is('archived_at', null).order('created_at', { ascending: false }).limit(80),
    supabaseAdmin.from('import_templates').select('id, import_type, name, sample_text, scope').or(`scope.eq.system,company_id.eq.${auth.membership.companyId}`).is('archived_at', null).order('import_type'),
  ])
  const runRows = (runs ?? []) as ImportRunRow[]
  const itemRows = (items ?? []) as ImportItemRow[]

  return (
    <AppShell auth={auth} title="Importera data" subtitle="Flytta in personal, resurser, kunder/objekt, uppdrag och projekt från Excel, Sheets eller CSV.">
      <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
        <ImportInputPanel />

        <section className="space-y-5">
          <div className="coordiqo-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Importmallar</h2>
                <p className="mt-1 text-sm text-slate-500">Använd mallarna som rubrikrad när du exporterar från gamla system.</p>
              </div>
              <StatusBadge status={`${templates?.length ?? 0} mallar`} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(templates ?? []).map((template) => (
                <div key={template.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-950">{template.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{template.import_type}</p>
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{template.sample_text}</pre>
                </div>
              ))}
            </div>
          </div>

          <div className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Importhistorik</h2>
            <div className="mt-4 space-y-3">
              {runRows.length ? runRows.map((run) => {
                const failedItems = itemRows.filter((item) => item.import_run_id === run.id && item.status === 'failed')
                return (
                  <div key={run.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{targets.find((target) => target.value === run.import_type)?.label ?? run.import_type}</p>
                        <p className="mt-1 text-xs text-slate-500">{run.source_name ?? 'copy-paste'} · {new Date(run.created_at).toLocaleString('sv-SE')}</p>
                      </div>
                      <StatusBadge status={run.status} />
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{run.rows_imported}/{run.rows_total} importerade · {run.rows_failed} fel</p>
                    {failedItems.length ? <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{failedItems.slice(0, 4).map((item) => <p key={item.id}>Rad {item.row_number}: {item.error_message}</p>)}</div> : null}
                    {run.rows_imported > 0 ? (
                      <form action={undoImportRunAction} className="mt-3">
                        <input type="hidden" name="import_run_id" value={run.id} />
                        <button className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Ångra import</button>
                      </form>
                    ) : null}
                  </div>
                )
              }) : <p className="text-sm text-slate-600">Inga importer ännu.</p>}
            </div>
          </div>

          <Link href="/onboarding" className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
            <h2 className="text-lg font-semibold text-slate-950">Nästa steg i onboarding</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">När grunddata är importerad kan du fortsätta med branschmodell, moduler, planeringsmallar och första uppdrag.</p>
          </Link>
        </section>
      </div>
    </AppShell>
  )
}

