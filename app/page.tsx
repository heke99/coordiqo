import Link from 'next/link'

const sections = [
  {
    title: 'Problem',
    description: 'Many teams plan in spreadsheets, chats and disconnected tools. That makes staffing, routes, resources and project follow-up hard to control.',
  },
  {
    title: 'Solution',
    description: 'Coordiqo brings staff, assignments, routes, resources, projects, deviations, reporting and AI-assisted decisions into one operations command center.',
  },
  {
    title: 'Industries',
    description: 'Start with transport, cleaning, home care, property service, construction or municipality presets. They prepare defaults only and can be edited later.',
  },
  {
    title: 'AI planner',
    description: 'AI-based decision support can summarize operations, classify messages, suggest deviations and help planners see risk faster.',
  },
  {
    title: 'Resource tracking',
    description: 'Track keys, vehicles, equipment, tools and responsibility across staff, tasks, routes and projects.',
  },
  {
    title: 'Mobile staff view',
    description: 'Field teams get a simple mobile day view for tasks, resources, progress and deviation reporting.',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell space-y-6">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">Cq</div>
            <div>
              <p className="font-semibold tracking-tight text-slate-950">Coordiqo</p>
              <p className="text-xs text-slate-500">Operations Command Center</p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">Log in</Link>
            <Link href="/book-demo" className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Book demo</Link>
          </nav>
        </header>

        <section className="coordiqo-card overflow-hidden p-7 sm:p-10 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="coordiqo-badge coordiqo-badge--success">Guided onboarding</div>
              <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                Smart planning for staff, assignments and resources
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Coordiqo helps companies plan staff, routes, assignments, resources and projects in one simple system — with AI support for faster decisions and better control.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/book-demo" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Book demo</Link>
                <a href="#how-it-works" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800">See how it works</a>
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-2xl">
              <p className="text-sm font-semibold text-slate-300">One command center</p>
              <div className="mt-6 grid gap-3">
                {['Planning', 'Routes', 'Projects', 'Resources', 'Mobile execution', 'Deviations', 'AI support', 'Billing underlay'].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <div key={section.title} className="coordiqo-card p-6">
              <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{section.description}</p>
            </div>
          ))}
        </section>

        <section className="coordiqo-card bg-slate-950 p-8 text-white sm:p-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Ready to see Coordiqo?</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Request access and we will qualify your company, book a guided walkthrough and help set up the right starting defaults.</p>
            </div>
            <Link href="/book-demo" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Contact us</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
