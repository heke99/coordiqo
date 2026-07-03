import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4">
      <Link href="/" className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">Cq</div>
        <div>
          <p className="font-semibold tracking-tight text-slate-950">Coordiqo</p>
          <p className="text-xs text-slate-500">Planering, personal och resurser</p>
        </div>
      </Link>
      <nav className="flex items-center gap-2">
        <Link href="/login" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">Logga in</Link>
        <Link href="/book-demo" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Boka demo</Link>
      </nav>
    </header>
  )
}
