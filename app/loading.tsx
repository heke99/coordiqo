export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-36 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200" />
          <div className="h-36 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200" />
          <div className="h-36 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200" />
        </div>
        <div className="h-72 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200" />
      </div>
    </div>
  )
}
