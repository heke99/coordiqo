import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'

export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell space-y-6">
        <SiteHeader />
        <article className="coordiqo-card mx-auto w-full max-w-3xl p-7 sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          {updated ? <p className="mt-2 text-xs text-slate-400">Senast uppdaterad: {updated}</p> : null}
          <div className="prose-slate mt-6 space-y-6 text-sm leading-7 text-slate-700 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-950 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
            {children}
          </div>
        </article>
        <SiteFooter />
      </div>
    </main>
  )
}
