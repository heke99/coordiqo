export const dynamic = 'force-dynamic'

import Link from 'next/link'

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <div className="coordiqo-card max-w-xl p-8 text-center">
          <div className="coordiqo-badge coordiqo-badge--success mx-auto">Coordiqo</div>
          <h1 className="mt-5 text-2xl font-semibold text-slate-950">Du saknar behörighet för den här sidan</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Din roll ger inte åtkomst till den här delen av systemet. Kontakta din administratör om du behöver
            utökad behörighet, eller gå tillbaka till översikten.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
              Till översikten
            </Link>
            <Link href="/settings/support" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800">
              Kontakta support
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
