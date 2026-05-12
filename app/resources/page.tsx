export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchFilter } from '@/components/ui/search-filter'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageResources } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

type ResourcesPageProps = { searchParams?: Promise<{ q?: string; status?: string }> }

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const auth = await requireAuth()
  if (!auth.membership) return null
  const params = await searchParams
  const q = params?.q?.trim() ?? ''
  const status = params?.status ?? 'all'

  let query = supabaseAdmin
    .from('resource_assets')
    .select('id, name, asset_tag, status, location_label, resource_types(name), staff_profiles(full_name), teams(name)')
    .eq('company_id', auth.membership.companyId)
    .is('archived_at', null)
    .order('name')

  if (status !== 'all') query = query.eq('status', status)
  if (q) query = query.or(`name.ilike.%${q}%,asset_tag.ilike.%${q}%,location_label.ilike.%${q}%`)

  const { data: resources, error } = await query
  const canManage = canManageResources(auth.membership.companyRole)

  return (
    <AppShell auth={auth} title="Resurser" subtitle="Fordon, utrustning, nycklar, taggar och andra resurser som kan påverka planering.">
      <div className="space-y-5">
        <SearchFilter action="/resources" defaultValue={q} placeholder="Sök resurs, tagg eller plats" newHref={canManage ? '/resources/new' : undefined} newLabel="Skapa resurs">
          <select name="status" defaultValue={status} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
            <option value="all">Alla statusar</option><option value="available">Tillgänglig</option><option value="assigned">Tilldelad</option><option value="maintenance">Underhåll</option><option value="inactive">Inaktiv</option>
          </select>
        </SearchFilter>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

        {!resources?.length ? (
          <EmptyState eyebrow="Batch 3" title="Lägg in första resursen" description="Resurser kan vara fordon, nycklar, utrustning, taggar, scanners eller annat som krävs för att utföra uppdrag. De kopplas senare till personal, team och planering." action={canManage ? <Link className="inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" href="/resources/new">Skapa resurs</Link> : undefined} />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resources.map((resource: any) => (
              <Link key={resource.id} href={`/resources/${resource.id}`} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-sm font-medium text-slate-500">{resource.resource_types?.name ?? 'Resurs'}</p><h2 className="mt-2 text-lg font-semibold text-slate-950">{resource.name}</h2></div>
                  <StatusBadge status={resource.status} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{resource.asset_tag ?? 'Ingen tagg'} · {resource.location_label ?? 'Ingen plats'}</p>
                <p className="mt-2 text-sm text-slate-500">{resource.staff_profiles?.full_name ?? resource.teams?.name ?? 'Ej tilldelad'}</p>
              </Link>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  )
}
