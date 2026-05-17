export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchFilter } from '@/components/ui/search-filter'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageEntities } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

type EntitiesPageProps = { searchParams?: Promise<{ q?: string; type?: string; status?: string }> }

export default async function EntitiesPage({ searchParams }: EntitiesPageProps) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const params = await searchParams
  const q = params?.q?.trim() ?? ''
  const type = params?.type ?? 'all'
  const status = params?.status ?? 'active'

  const { data: entityTypes } = await supabaseAdmin
    .from('entity_types')
    .select('id, code, label_singular, label_plural')
    .eq('company_id', auth.membership.companyId)
    .eq('is_active', true)
    .is('archived_at', null)
    .order('sort_order')

  let query = supabaseAdmin
    .from('entities')
    .select('id, name, external_id, status, priority, summary, created_at, entity_types(label_singular, label_plural, code), teams(name)')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (status !== 'all') query = query.eq('status', status)
  if (type !== 'all') query = query.eq('entity_type_id', type)
  if (q) query = query.or(`name.ilike.%${q}%,external_id.ilike.%${q}%,summary.ilike.%${q}%`)

  const { data: entities, error } = await query
  const canManage = canManageEntities(auth.membership.companyRole)

  return (
    <AppShell auth={auth} title="Objekt" subtitle="Skapa och hantera de objekt som uppdrag och planering byggs runt: kunder, patienter, platser, fastigheter, zoner eller mottagare.">
      <div className="space-y-5">
        <SearchFilter action="/entities" defaultValue={q} placeholder="Sök objekt, ID eller sammanfattning" newHref={canManage ? '/entities/new' : undefined} newLabel="Skapa objekt">
          <select name="type" defaultValue={type} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
            <option value="all">Alla typer</option>{entityTypes?.map((entityType) => <option key={entityType.id} value={entityType.id}>{entityType.label_plural}</option>)}
          </select>
          <select name="status" defaultValue={status} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
            <option value="active">Aktiva</option><option value="inactive">Inaktiva</option><option value="all">Alla</option>
          </select>
        </SearchFilter>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

        {!entities?.length ? (
          <EmptyState
            eyebrow="Objekt"
            title="Skapa första objektet"
            description="Objektmodellen låser inte företaget. Vilka objekt som visas styrs av branschpresets och kan senare anpassas per företag."
            action={canManage ? <Link className="inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" href="/entities/new">Skapa objekt</Link> : undefined}
          />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {entities.map((entity: any) => (
              <Link key={entity.id} href={`/entities/${entity.id}`} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-sm font-medium text-slate-500">{entity.entity_types?.label_singular ?? 'Objekt'} · {entity.external_id ?? 'utan externt ID'}</p><h2 className="mt-2 truncate text-lg font-semibold text-slate-950">{entity.name}</h2></div>
                  <StatusBadge status={entity.status} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{entity.summary ?? 'Ingen sammanfattning ännu.'}</p>
                <p className="mt-2 text-sm text-slate-500">{entity.teams?.name ?? 'Inget team'} · prioritet {entity.priority}</p>
              </Link>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  )
}
