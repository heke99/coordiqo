import Link from 'next/link'

type SearchFilterProps = {
  action: string
  defaultValue?: string
  placeholder?: string
  newHref?: string
  newLabel?: string
  children?: React.ReactNode
}

export function SearchFilter({ action, defaultValue, placeholder = 'Sök...', newHref, newLabel = 'Skapa ny', children }: SearchFilterProps) {
  return (
    <div className="coordiqo-card p-4">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            name="q"
            defaultValue={defaultValue ?? ''}
            placeholder={placeholder}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 sm:max-w-md"
          />
          {children}
          <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
            Sök / filtrera
          </button>
        </div>
        {newHref && (
          <Link href={newHref} className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            {newLabel}
          </Link>
        )}
      </form>
    </div>
  )
}
