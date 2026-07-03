import Link from 'next/link'

import { switchActiveCompanyAction } from '@/lib/platform/actions'
import {
  COMPANY_ROLE_LABELS,
  hasMinimumCompanyRole,
  isPlatformAdminRole,
  type CompanyRole,
} from '@/lib/auth/permissions'
import type { AuthContext } from '@/lib/auth/session'
import { resolveIndustryTerminology, type IndustryTerminology } from '@/lib/industry/registry'
import { createTranslator, type TranslationKey } from '@/lib/i18n/labels'

type NavItem = {
  href: string
  labelKey?: TranslationKey
  label?: string
  descriptionKey?: TranslationKey
  description?: string
  /** Lowest company role that should see the item. Platform admins always see everything. */
  minRole: CompanyRole
  /** Restrict item to specific industries (e.g. property intake). */
  industries?: string[]
}

function buildPrimaryNav(terminology: IndustryTerminology): NavItem[] {
  return [
    { href: '/dashboard', labelKey: 'nav.dashboard', descriptionKey: 'nav.dashboard.description', minRole: 'read_only' },
    { href: '/operations/today', labelKey: 'nav.operationsToday', descriptionKey: 'nav.operationsToday.description', minRole: 'team_lead' },
    { href: '/planning', labelKey: 'nav.planning', descriptionKey: 'nav.planning.description', minRole: 'planner' },
    { href: '/optimization', labelKey: 'nav.optimization', descriptionKey: 'nav.optimization.description', minRole: 'planner' },
    { href: '/planning/assistant', labelKey: 'nav.aiPlanner', descriptionKey: 'nav.aiPlanner.description', minRole: 'planner' },
    { href: '/schedule', label: terminology.schedule, descriptionKey: 'nav.schedule.description', minRole: 'team_lead' },
    { href: '/tasks', label: terminology.tasks, descriptionKey: 'nav.tasks.description', minRole: 'team_lead' },
    { href: '/entities', label: terminology.entities, descriptionKey: 'nav.entities.description', minRole: 'team_lead' },
    { href: '/resources', label: terminology.resources, descriptionKey: 'nav.resources.description', minRole: 'team_lead' },
    { href: '/staff', label: terminology.staff, descriptionKey: 'nav.staff.description', minRole: 'supervisor' },
    { href: '/teams', labelKey: 'nav.teams', descriptionKey: 'nav.teams.description', minRole: 'supervisor' },
    { href: '/projects', labelKey: 'nav.projects', descriptionKey: 'nav.projects.description', minRole: 'planner' },
    { href: '/chat', labelKey: 'nav.chat', descriptionKey: 'nav.chat.description', minRole: 'read_only' },
  ]
}

const mobileNav: NavItem[] = [
  { href: '/staff/mobile/day', label: 'Min dag', description: 'Dagens arbete i mobilen', minRole: 'read_only' },
  { href: '/staff/mobile/resources', label: 'Mina resurser', description: 'Kvittera och lämna tillbaka', minRole: 'read_only' },
]

const secondaryNav: NavItem[] = [
  { href: '/planning/templates', labelKey: 'nav.planningTemplates', minRole: 'planner' },
  { href: '/projects/templates', labelKey: 'nav.projectTemplates', minRole: 'planner' },
  { href: '/availability', labelKey: 'nav.availability', minRole: 'team_lead' },
  { href: '/availability/templates', labelKey: 'nav.availabilityTemplates', minRole: 'planner' },
  { href: '/availability/presets', labelKey: 'nav.shiftPresets', minRole: 'planner' },
  { href: '/work-orders', labelKey: 'nav.workOrders', minRole: 'planner' },
  { href: '/deviations', labelKey: 'nav.deviations', minRole: 'staff' },
  { href: '/messages', labelKey: 'nav.messages', minRole: 'team_lead' },
  { href: '/reports', labelKey: 'nav.reports', minRole: 'operations_manager' },
  { href: '/integrations', labelKey: 'nav.integrations', minRole: 'company_admin' },
  { href: '/pilot', labelKey: 'nav.pilot', minRole: 'company_admin' },
  { href: '/property', labelKey: 'nav.property', minRole: 'planner', industries: ['property', 'facility_management'] },
]

const settingsNav: NavItem[] = [
  { href: '/settings', labelKey: 'app.settings', minRole: 'operations_manager' },
  { href: '/settings/industry', labelKey: 'nav.industry', minRole: 'company_admin' },
  { href: '/settings/skills', labelKey: 'nav.skills', minRole: 'supervisor' },
  { href: '/settings/permissions', labelKey: 'nav.permissions', minRole: 'operations_manager' },
  { href: '/settings/invitations', labelKey: 'nav.invitations', minRole: 'operations_manager' },
  { href: '/settings/health', labelKey: 'nav.health', minRole: 'operations_manager' },
  { href: '/settings/support', labelKey: 'nav.support', minRole: 'company_admin' },
  { href: '/audit', labelKey: 'nav.audit', minRole: 'operations_manager' },
  { href: '/notifications', labelKey: 'nav.notifications', minRole: 'read_only' },
]

const platformNav: NavItem[] = [
  { href: '/admin', labelKey: 'nav.admin', minRole: 'read_only' },
  { href: '/admin/demo-requests', labelKey: 'nav.demoRequests', minRole: 'read_only' },
  { href: '/admin/companies', labelKey: 'nav.companies', minRole: 'read_only' },
  { href: '/admin/access-requests', labelKey: 'nav.accessRequests', minRole: 'read_only' },
  { href: '/admin/industries', label: 'Branscher', minRole: 'read_only' },
  { href: '/admin/support', label: 'Supportärenden', minRole: 'read_only' },
  { href: '/admin/go-live', label: 'Go-live', minRole: 'read_only' },
]

type AppShellProps = {
  auth: AuthContext
  title: string
  subtitle?: string
  children: React.ReactNode
  actions?: React.ReactNode
}

export async function AppShell({ auth, title, subtitle, children, actions }: AppShellProps) {
  const { t } = createTranslator(auth.membership?.locale)
  const companyName = auth.membership?.companyName ?? t('app.noActiveWorkspace')
  const role = auth.membership?.companyRole ? COMPANY_ROLE_LABELS[auth.membership.companyRole as CompanyRole] : t('app.noRole')
  const industryLabel = auth.membership?.industryLabel ?? t('app.noIndustry')
  const isPlatformAdmin = isPlatformAdminRole(auth.platformRole)
  const companyRole = (auth.membership?.companyRole ?? null) as CompanyRole | null
  const industryType = auth.membership?.industryType ?? null

  const terminology = auth.membership
    ? await resolveIndustryTerminology(auth.membership.companyId, industryType)
    : await resolveIndustryTerminology(null, 'other')

  const visible = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.industries && (!industryType || !item.industries.includes(industryType)) && !isPlatformAdmin) return false
      if (isPlatformAdmin) return true
      return hasMinimumCompanyRole(companyRole, item.minRole)
    })

  const navLabel = (item: NavItem) => item.label ?? (item.labelKey ? t(item.labelKey) : item.href)
  const navDescription = (item: NavItem) => item.description ?? (item.descriptionKey ? t(item.descriptionKey) : null)

  const primaryItems = visible(buildPrimaryNav(terminology))
  const mobileItems = visible(mobileNav)
  const secondaryItems = visible(secondaryNav)
  const settingsItems = visible(settingsNav)

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white/95 backdrop-blur lg:flex lg:flex-col">
        <div className="shrink-0 px-4 pb-3 pt-5">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-3xl px-2 py-2 transition hover:bg-slate-50">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
              Cq
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-slate-950">Coordiqo</p>
              <p className="text-xs text-slate-500">{t('app.product.subtitle')}</p>
            </div>
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 coordiqo-scrollbar">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('app.activeWorkspace')}</p>
            <p className="mt-2 truncate text-sm font-semibold text-slate-950">{companyName}</p>
            <p className="mt-1 text-xs text-slate-500">{industryLabel}</p>
            <p className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              {role}
            </p>

            {auth.memberships.length > 1 ? (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('app.switchCompany')}</p>
                <div className="mt-2 space-y-2">
                  {auth.memberships.map((membership) => (
                    <form key={membership.membershipId} action={switchActiveCompanyAction}>
                      <input type="hidden" name="membership_id" value={membership.membershipId} />
                      <button
                        className={`w-full rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition ${
                          membership.companyId === auth.membership?.companyId
                            ? 'border-slate-950 bg-white text-slate-950'
                            : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white hover:text-slate-950'
                        }`}
                      >
                        <span className="block truncate">{membership.companyName}</span>
                        <span className="mt-0.5 block truncate font-normal text-slate-500">{membership.industryLabel}</span>
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <nav className="mt-6 space-y-1">
            {primaryItems.map((item) => (
              <Link key={item.href} href={item.href} className="group block rounded-2xl px-3 py-3 transition hover:bg-slate-100">
                <span className="text-sm font-semibold text-slate-900">{navLabel(item)}</span>
                {navDescription(item) && <span className="mt-0.5 block text-xs text-slate-500">{navDescription(item)}</span>}
              </Link>
            ))}
          </nav>

          {mobileItems.length ? (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Mobil</p>
              <nav className="mt-2 space-y-1">
                {mobileItems.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950">
                    {navLabel(item)}
                  </Link>
                ))}
              </nav>
            </div>
          ) : null}

          {secondaryItems.length ? (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('app.more')}</p>
              <nav className="mt-2 space-y-1 pb-4">
                {secondaryItems.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950">
                    {navLabel(item)}
                  </Link>
                ))}
              </nav>
            </div>
          ) : null}

          {isPlatformAdmin ? (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('app.platform')}</p>
              <nav className="mt-2 space-y-1 pb-4">
                {platformNav.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950">
                    {navLabel(item)}
                  </Link>
                ))}
              </nav>
            </div>
          ) : null}

          {settingsItems.length ? (
            <div className="border-t border-slate-200 pt-4">
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('app.settings')}</p>
              <nav className="mt-2 space-y-1 pb-4">
                {settingsItems.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950">
                    {navLabel(item)}
                  </Link>
                ))}
              </nav>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">{t('app.status')}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {t('app.statusDescription')}
            </p>
            <form action="/api/logout" method="post" className="mt-4">
              <button className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
                {t('app.logout')}
              </button>
            </form>
          </div>
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
          <nav className="flex gap-2 overflow-x-auto pb-1 coordiqo-scrollbar">
            {[...primaryItems, ...mobileItems, ...secondaryItems, ...(isPlatformAdmin ? platformNav : []), ...settingsItems].map((item) => (
              <Link key={item.href} href={item.href} className="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                {navLabel(item)}
              </Link>
            ))}
          </nav>
          {auth.memberships.length > 1 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 coordiqo-scrollbar">
              {auth.memberships.map((membership) => (
                <form key={membership.membershipId} action={switchActiveCompanyAction} className="shrink-0">
                  <input type="hidden" name="membership_id" value={membership.membershipId} />
                  <button className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                    {membership.companyName}
                  </button>
                </form>
              ))}
            </div>
          ) : null}
          <form action="/api/logout" method="post" className="mt-2">
            <button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{t('app.logout')}</button>
          </form>
        </div>

        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
