export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import { SetupRequestForm, type SetupOption } from '@/components/setup/setup-request-form'
import { getActiveIndustryProfiles, getOperationalModels } from '@/lib/industry/registry'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export default async function SetupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership } = await supabaseAdmin
    .from('company_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .is('archived_at', null)
    .limit(1)
    .maybeSingle()

  if (membership) {
    redirect('/dashboard')
  }

  const [industryProfiles, operationalModels] = await Promise.all([
    getActiveIndustryProfiles(),
    getOperationalModels(),
  ])

  const industryOptions: SetupOption[] = industryProfiles.map((profile) => ({
    value: profile.code,
    label: profile.nameSv,
  }))

  const modelOptions: SetupOption[] = operationalModels.map((model) => ({
    value: model.code,
    label: model.label,
  }))

  const defaultIndustry = industryOptions.find((option) => option.value === 'other')?.value ?? industryOptions[0]?.value ?? 'other'

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="coordiqo-shell grid min-h-[calc(100vh-3rem)] gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="coordiqo-card p-6 sm:p-8 lg:p-10">
          <div className="space-y-6">
            <div className="coordiqo-badge coordiqo-badge--success">Kom igång</div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Ansök om Coordiqo-miljö
              </h1>
              <p className="max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Du har ingen aktiv företagsmiljö ännu. Skicka en ansökan så granskar Coordiqo-teamet uppgifterna,
                skapar bolaget och aktiverar första företagsadministratör.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-900">Det som skickas nu</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• Bolagsansökan till Coordiqo-teamet</li>
                  <li>• Förslag på bransch, arbetssätt och språk</li>
                  <li>• Uppgifter för första företagsadministratör</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-900">Bra att ha redo</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• Bolagsnamn och organisationsnummer</li>
                  <li>• Vilken bransch ni tillhör</li>
                  <li>• Hur arbetet fungerar i praktiken</li>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Inloggat konto</p>
              <p className="mt-1 text-base font-semibold text-slate-950">{user.email ?? 'Okänt konto'}</p>
            </div>
          </div>
        </section>

        <SetupRequestForm
          industryOptions={industryOptions}
          modelOptions={modelOptions}
          defaultIndustry={defaultIndustry}
          defaultModel="route_based"
        />
      </div>
    </main>
  )
}
