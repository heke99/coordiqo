'use client'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-3xl border border-red-100 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-600">Något gick fel</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Sidan kunde inte laddas</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Försök igen. Om felet kommer tillbaka kan det bero på inställningar, behörigheter eller en tillfällig teknisk störning.
        </p>
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">{error.message}</p>
        <button onClick={reset} className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
          Försök igen
        </button>
      </div>
    </div>
  )
}
