import { requireAuth } from '@/lib/auth/session'

export default async function DashboardPage() {
  const auth = await requireAuth()

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-wide text-black/50">Coordiqo • Batch 1</p>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-2 text-sm text-black/70">
            Du är inloggad som {auth.email ?? 'okänd användare'}.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-black/10 p-5">
            <h2 className="text-lg font-semibold">Plattformsroll</h2>
            <p className="mt-2 text-sm text-black/70">{auth.platformRole ?? 'Ingen plattformsroll'}</p>
          </div>

          <div className="rounded-2xl border border-black/10 p-5">
            <h2 className="text-lg font-semibold">Aktivt företag</h2>
            {auth.membership ? (
              <div className="mt-2 text-sm text-black/70">
                <p>Namn: {auth.membership.companyName}</p>
                <p>Role: {auth.membership.companyRole}</p>
                <p>Company ID: {auth.membership.companyId}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-amber-700">Ingen aktiv företagstillhörighet hittades.</p>
            )}
          </div>
        </section>

        <form action="/api/logout" method="post">
          <button className="rounded-xl border border-black/15 px-4 py-2 text-sm font-medium">
            Logga ut
          </button>
        </form>
      </div>
    </main>
  )
}
