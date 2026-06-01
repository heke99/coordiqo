export const dynamic = 'force-dynamic'

import Link from 'next/link'

import { AppShell } from '@/components/app/app-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

function hours(minutes: number | null | undefined) {
  return Math.round(Number(minutes ?? 0) / 60)
}

function money(value: number | null | undefined, currency = 'SEK') {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value ?? 0))
}

export default async function ProjectsPage() {
  const auth = await requireAuth()
  if (!auth.membership) return null

  const [{ data: projects }, { data: templates }] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('id, name, status, priority, target_start_date, deadline_date, planned_workers, estimated_effort_minutes, estimated_calendar_minutes, estimated_total_cost, currency, created_at, entities(display_name), project_templates(name)')
      .eq('company_id', auth.membership.companyId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(80),
    supabaseAdmin
      .from('project_templates')
      .select('id, name, description, scope, industry_type, project_type')
      .is('archived_at', null)
      .eq('status', 'active')
      .or(`scope.eq.system,company_id.eq.${auth.membership.companyId}`)
      .order('scope')
      .order('name')
      .limit(20),
  ])

  const visibleTemplates = (templates ?? []).filter((template: any) => template.scope === 'company' || !template.industry_type || template.industry_type === auth.membership?.industryType)

  return (
    <AppShell
      auth={auth}
      title="Projekt"
      subtitle="Skapa projekt från mallar, räkna tid/kostnad och skapa uppdrag som kan skickas till planeringsmotorn."
      actions={<div className="flex gap-2"><Link href="/projects/templates" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Projektmallar</Link><Link href="/projects/wizard" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Starta projektguide</Link></div>}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
        <section className="space-y-4">
          {projects?.length ? projects.map((project: any) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="coordiqo-card block p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950">{project.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{project.entities?.display_name ?? 'Inget objekt'} · {project.project_templates?.name ?? 'Egen mall'} · {project.planned_workers ?? 1} personal</p>
                  <p className="mt-2 text-xs text-slate-500">{hours(project.estimated_effort_minutes)} arbetstimmar · ca {hours(project.estimated_calendar_minutes)} schematimmar · {money(project.estimated_total_cost, project.currency ?? 'SEK')}</p>
                </div>
                <div className="flex flex-wrap gap-2"><StatusBadge status={project.status} /><StatusBadge status={project.priority} /></div>
              </div>
            </Link>
          )) : <EmptyState eyebrow="Projekt" title="Inga projekt ännu" description="Skapa ett projekt från en branschmall. Systemet räknar ut tid/kostnad från regler och kan skapa uppdrag direkt." action={<Link href="/projects/wizard" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Starta projektguide</Link>} />}
        </section>

        <aside className="space-y-5">
          <section className="coordiqo-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Tillgängliga projektmallar</h2>
            <div className="mt-4 space-y-3">
              {visibleTemplates.length ? visibleTemplates.map((template: any) => (
                <Link key={template.id} href={`/projects/new?template=${template.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-950">{template.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{template.description ?? 'Ingen beskrivning'}</p>
                  <p className="mt-2 text-xs text-slate-400">{template.scope === 'company' ? 'Egen mall' : 'Systempreset'} · {template.project_type}</p>
                </Link>
              )) : <p className="text-sm text-slate-600">Inga projektmallar är tillgängliga för denna miljö.</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
            <h2 className="text-lg font-semibold">Viktigt om AI-lagret</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">AI kan hjälpa ansvariga att strukturera intag och föreslå saknade svar. Själva tid och kostnad räknas från företagets kalkylregler och kan ändras per bolag.</p>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
