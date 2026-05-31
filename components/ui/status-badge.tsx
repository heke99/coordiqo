type StatusBadgeProps = {
  status: string | null | undefined
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
}

const toneClasses: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
}

const statusLabels: Record<string, string> = {
  active: 'Aktiv',
  available: 'Tillgänglig',
  assigned: 'Tilldelad',
  planned: 'Planerad',
  maintenance: 'Underhåll',
  inactive: 'Inaktiv',
  archived: 'Arkiverad',
  lost: 'Förlorad',
  disabled: 'Avstängd',
  ready: 'Redo',
  needs_action: 'Behöver åtgärd',
  blocked: 'Blockerad',
  completed: 'Klar',
  new: 'Ny',
  contacted: 'Kontaktad',
  demo_booked: 'Möte bokat',
  offer_sent: 'Offert skickad',
  won: 'Vunnen',
  onboarding_started: 'Startad',
  company_admin: 'Företagsadministratör',
  operations_manager: 'Driftansvarig',
  planner: 'Planerare',
  staff: 'Personal',
  proposed: 'Föreslagen',
  approved: 'Godkänd',
  failed: 'Misslyckad',
  not_configured: 'Inte kopplad',
}

export function statusTone(status: string | null | undefined): StatusBadgeProps['tone'] {
  if (!status) return 'neutral'
  if (['active', 'available', 'assigned'].includes(status)) return 'success'
  if (['planned', 'maintenance', 'inactive'].includes(status)) return 'warning'
  if (['archived', 'lost', 'disabled'].includes(status)) return 'danger'
  return 'neutral'
}

export function StatusBadge({ status, tone }: StatusBadgeProps) {
  const safeStatus = status ?? 'Okänd'
  const resolvedTone: NonNullable<StatusBadgeProps['tone']> = tone ?? statusTone(safeStatus) ?? 'neutral'
  const label = statusLabels[safeStatus] ?? safeStatus.replace(/_/g, ' ')

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${toneClasses[resolvedTone]}`}>
      {label}
    </span>
  )
}
