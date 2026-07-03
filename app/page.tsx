import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { trackProductEvent } from '@/lib/analytics/product-events'
import { getActiveIndustryProfiles } from '@/lib/industry/registry'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const problems = [
  'Planering sker i Excel och lösa listor',
  'Personal, uppdrag och resurser ligger i olika system',
  'Svårt att se vad som händer ute på fältet',
  'Svårt att omplanera vid sjukdom eller akuta ändringar',
  'Nycklar, fordon och utrustning saknar tydligt ansvar',
  'Chefer saknar överblick och beslutsunderlag',
]

const solutions = [
  { title: 'Smart daglig planering', description: 'Fördela dagens arbete på rätt personal med hänsyn till kompetens, tider och regler.' },
  { title: 'Rutter och restider', description: 'Se stopp i rätt ordning med restider — även utan extern karttjänst.' },
  { title: 'Personal och kompetenser', description: 'Håll koll på vem som kan vad, certifikat, tillgänglighet och team.' },
  { title: 'Resurser och ansvar', description: 'Nycklar, fordon, maskiner och utrustning med tydligt ansvar och kvittens.' },
  { title: 'Mobil vy för utförare', description: 'Personalen ser dagens arbete i mobilen, startar, slutför och rapporterar direkt.' },
  { title: 'Avvikelser och uppföljning', description: 'Fånga avvikelser när de händer och följ upp med rapporter och beslutsstöd.' },
]

const steps = [
  { step: '1', title: 'Välj bransch', description: 'Coordiqo anpassar ordval, uppdragstyper, resurser och onboarding efter er verksamhet.' },
  { step: '2', title: 'Lägg in verksamheten', description: 'Personal, kunder eller objekt, uppdragstyper och resurser — med färdiga standarder som går att ändra.' },
  { step: '3', title: 'Planera och följ upp', description: 'Planera dagen smart, låt personalen jobba i mobilen och följ upp avvikelser och resultat.' },
]

const trust = [
  { title: 'Företagsseparation', description: 'Varje kunds data är strikt separerad med radnivåskydd i databasen.' },
  { title: 'Roller och behörighet', description: 'Alla ser bara det deras roll tillåter — från administratör till fältpersonal.' },
  { title: 'Spårbarhet', description: 'Viktiga ändringar loggas så ni alltid kan se vem som gjorde vad.' },
  { title: 'Krypterad trafik', description: 'All kommunikation sker över krypterade förbindelser.' },
]

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  const industries = await getActiveIndustryProfiles()
  void trackProductEvent('homepage_viewed')

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell space-y-6">
        <SiteHeader />

        <section className="coordiqo-card overflow-hidden p-7 sm:p-10 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="coordiqo-badge coordiqo-badge--success">Branschanpassad från start</div>
              <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                Planering, personal och resurser — anpassat efter din bransch
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Coordiqo hjälper företag att planera uppdrag, personal, rutter, resurser och avvikelser i ett system.
                Välj bransch, arbetssätt och regler — resten anpassas efter verksamheten.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/book-demo" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Boka demo</Link>
                <a href="#branscher" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800">Se branscher</a>
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-2xl">
              <p className="text-sm font-semibold text-slate-300">Allt på ett ställe</p>
              <div className="mt-6 grid gap-3">
                {['Smart planering', 'Rutter och restider', 'Personal och kompetenser', 'Resurser och ansvar', 'Mobil vy för utförare', 'Avvikelser', 'Rapporter', 'Projekt och kalkyl'].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="coordiqo-card p-7 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Känner du igen dig?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">De här problemen möter vi hos nästan alla verksamheter med personal ute på fältet.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {problems.map((problem) => (
              <div key={problem} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700">{problem}</div>
            ))}
          </div>
        </section>

        <section id="sa-fungerar-det" className="coordiqo-card p-7 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Så fungerar det</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((item) => (
              <div key={item.step} className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">{item.step}</div>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="branscher" className="coordiqo-card p-7 sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Branscher vi stödjer</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Varje bransch får egna ordval, uppdragstyper, resurser och onboarding — utan att något låses fast.
                Hittar du inte din bransch? Vi sätter upp den tillsammans.
              </p>
            </div>
            <Link href="/book-demo" className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800">Fråga om din bransch</Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {industries.filter((industry) => industry.code !== 'other').map((industry) => (
              <div key={industry.code} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">{industry.nameSv}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{industry.descriptionSv}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="coordiqo-card p-7 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Viktiga funktioner</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {solutions.map((solution) => (
              <div key={solution.title} className="rounded-3xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-slate-950">{solution.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{solution.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="coordiqo-card p-7 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Från demo till pilot</h2>
              <ol className="mt-6 space-y-4">
                <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">1</span><p className="text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-900">Boka demo.</span> Vi visar rätt branschflöde för just er verksamhet.</p></li>
                <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">2</span><p className="text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-900">Starta pilot.</span> Vi sätter upp er miljö med guidad onboarding och era riktiga arbetsflöden.</p></li>
                <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">3</span><p className="text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-900">Gå i drift.</span> När piloten känns rätt går ni över till skarp drift — med support hela vägen.</p></li>
              </ol>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Säkerhet och kontroll</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {trust.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                  </div>
                ))}
              </div>
              <Link href="/sakerhet" className="mt-4 inline-flex text-sm font-semibold text-slate-900 underline-offset-4 hover:underline">Läs mer om säkerhet →</Link>
            </div>
          </div>
        </section>

        <section className="coordiqo-card bg-slate-950 p-8 text-white sm:p-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Redo att se Coordiqo för din bransch?</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Skicka en demoansökan så återkommer vi för att förstå er verksamhet, visa rätt branschflöde och hjälpa er sätta upp en pilot.
              </p>
            </div>
            <Link href="/book-demo" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Boka demo</Link>
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  )
}
