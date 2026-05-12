type EmptyStateProps = {
  eyebrow?: string
  title: string
  description: string
  action?: React.ReactNode
  children?: React.ReactNode
}

export function EmptyState({ eyebrow, title, description, action, children }: EmptyStateProps) {
  return (
    <section className="coordiqo-card p-6 sm:p-8">
      <div className="max-w-3xl">
        {eyebrow && <div className="coordiqo-badge coordiqo-badge--info">{eyebrow}</div>}
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </section>
  )
}
