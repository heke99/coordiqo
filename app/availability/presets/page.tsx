export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchFilter } from '@/components/ui/search-filter'
import { StatusBadge } from '@/components/ui/status-badge'
import { duplicateSystemShiftPresetAction } from '@/lib/platform/actions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

function timeLabel(value: string | null) {
  return value ? String(value).slice(0, 5) : '—'
}

export default async function ShiftPresetsPage({ searchParams }: { searchParams: Promise<{ q?: string; scope?: string }> }) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const params = await searchParams
  const q = params.q?.trim()
  const scope = params.scope?.trim()
  const industry = auth.membership.industryType

  let query = supabaseAdmin
    .from('shift_presets')
    .select('*')
    .is('archived_at', null)
    .eq('is_active', true)
    .or(`company_id.eq.${auth.membership.companyId},preset_scope.eq.system`)
    .order('preset_scope', { ascending: true })
    .order('is_favorite', { ascending: false })
    .order('name')

  if (scope) query = query.eq('preset_scope', scope)
  if (q) query = query.ilike('name', `%${q}%`)

  const { data, error } = await query
  const presets = (data ?? []).filter((preset: any) => preset.preset_scope === 'company' || !preset.industry_type || preset.industry_type === industry)

  return (
    <AppShell
      auth={auth}
      title="Passpresets"
      subtitle="Branschbaserade systempresets och egna företagspresets för snabb schema- och bulkplanering."
      actions={<Link href="/availability/presets/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Ny egen preset</Link>}
    >
      <div className="space-y-5">
        <SearchFilter action="/availability/presets" defaultValue={q} placeholder="Sök preset" newHref="/availability/presets/new" newLabel="Ny egen preset">
          <select name="scope" defaultValue={scope ?? ''} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
            <option value="">Alla</option>
            <option value="company">Egna presets</option>
            <option value="system">Systempresets</option>
          </select>
        </SearchFilter>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

        <section className="grid gap-4 lg:grid-cols-3">
          {presets?.length ? presets.map((preset: any) => (
            <div key={preset.id} className="coordiqo-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-950">{preset.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{timeLabel(preset.start_time)}–{timeLabel(preset.end_time)} · rast {preset.break_minutes ?? 0} min · buffer {preset.buffer_minutes ?? 0} min</p>
                </div>
                <StatusBadge status={preset.preset_scope === 'system' ? 'system' : 'egen'} />
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{preset.description ?? 'Ingen beskrivning.'}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1">{preset.transport_mode}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{preset.default_status}</span>
                {preset.industry_type ? <span className="rounded-full bg-slate-100 px-3 py-1">{preset.industry_type}</span> : <span className="rounded-full bg-slate-100 px-3 py-1">generell</span>}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {preset.preset_scope === 'company' ? (
                  <Link href={`/availability/presets/${preset.id}`} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">Redigera</Link>
                ) : (
                  <form action={duplicateSystemShiftPresetAction}>
                    <input type="hidden" name="id" value={preset.id} />
                    <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">Kopiera till egna</button>
                  </form>
                )}
                <Link href={`/schedule?preset=${preset.id}`} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Använd</Link>
              </div>
            </div>
          )) : <div className="lg:col-span-3"><EmptyState eyebrow="Batch 7B" title="Inga passpresets ännu" description="Skapa en egen preset eller kör SQL-migrationen för att få branschbaserade systempresets." action={<Link href="/availability/presets/new" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Skapa preset</Link>} /></div>}
        </section>
      </div>
    </AppShell>
  )
}
