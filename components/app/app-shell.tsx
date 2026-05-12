import Link from 'next/link'

import type { AuthContext } from '@/lib/auth/session'

const primaryNav = [
  { href: '/dashboard', label: 'Översikt', description: 'Dagens läge' },
  { href: '/teams', label: 'Team', description: 'Grupper och ansvar' },
  { href: '/staff', label: 'Personal', description: 'Profiler och roller' },
  { href: '/resources', label: 'Resurser', description: 'Fordon, utrustning och nycklar' },
  { href: '/entities', label: 'Objekt', description: 'Branschstyrda objekt' },
  { href: '/tasks', label: 'Uppdrag', description: 'Ärenden och arbetsorder' },
]

const settingsNav = [
  { href: '/settings/industry', label: 'Branschmotor' },
  { href: '/settings/entity-types', label: 'Objekttyper' },
  { href: '/settings/invitations', label: 'Inbjudningar' },
  { href: '/settings/permissions', label: 'Behörigheter' },
  { href: '/settings', label: 'Inställningar' },
]

type AppShellProps = {
  auth: AuthContext
  title: string
  subtitle?: string
  children: React.ReactNode
  actions?: React.ReactNode
}

export function AppShell({ auth, title, subtitle, children, actions }: AppShellProps) {
  const companyName = auth.membership?.companyName ?? 'Ingen aktiv miljö'
  const role = auth.membership?.companyRole ?? 'saknar roll'
  const industryLabel = auth.membership?.industryLabel ?? 'Bransch ej vald'

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 overflow-y-auto border-r border-slate-200 bg-white/95 px-4 py-5 backdrop-blur lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-3 rounded-3xl px-2 py-2 transition hover:bg-slate-50">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
            Cq
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight text-slate-950">Coordiqo</p>
            <p className="text-xs text-slate-500">Operations platform</p>
          </div>
        </Link>

        <div className="mt-6 shrink-0 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Aktiv miljö</p>
          <p className="mt-2 truncate text-sm font-semibold text-slate-950">{companyName}</p>
          <p className="mt-1 text-xs text-slate-500">{industryLabel}</p>
          <p className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            {role}
          </p>
        </div>

        <div className="min-h-0 flex-1 py-6">
          <nav className="space-y-1">
            {primaryNav.map((item) => (
              <Link key={item.href} href={item.href} className="group block rounded-2xl px-3 py-3 transition hover:bg-slate-100">
                <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Plattform</p>
            <nav className="mt-2 space-y-1">
              {settingsNav.map((item) => (
                <Link key={item.href} href={item.href} className="block rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="shrink-0 rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-950">Status</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Foundation, branschmotor, personal, resurser, objekttyper och objektregister är aktiva. Nästa steg är uppdrag och planering.
          </p>
          <form action="/api/logout" method="post" className="mt-4">
            <button className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
              Logga ut
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-xs font-bold text-white">Cq</div>
                <p className="text-sm font-semibold text-slate-950">Coordiqo</p>
              </div>
              <p className="hidden text-xs font-medium uppercase tracking-wide text-slate-400 lg:block">{companyName}</p>
              <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{title}</h1>
              {subtitle && <p className="mt-1 hidden max-w-2xl text-sm text-slate-500 sm:block">{subtitle}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3">{actions}</div>
          </div>
        </header>

        <div className="border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {[...primaryNav, ...settingsNav].map((item) => (
              <Link key={item.href} href={item.href} className="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
