# Coordiqo

Coordiqo är en svensk SaaS-plattform för planering av **personal, uppdrag, rutter och
resurser** — anpassad efter kundens bransch via en dynamisk branschmotor. En kodbas,
många branscher: hemtjänst, städ, fastighet, bud/kurir, bygg, bevakning, bemanning,
kommunal verksamhet med flera.

## Teknikstack

- **Next.js 16** (App Router, React Server Components, server actions)
- **Supabase** (PostgreSQL med radnivåskydd/RLS, Auth, Storage)
- **Tailwind CSS 4**
- Valfria integrationer: Resend (e-post), GraphHopper/Valhalla (rutt), VROOM (optimering),
  Langflow (AI), Twilio (SMS) — alla med säkra reservlägen.

## Kom igång lokalt

```bash
npm install
cp .env.example .env.local   # fyll i Supabase-uppgifter
npm run dev
```

Databas: kör migreringarna i `supabase/migrations/` i ordning mot ditt Supabase-projekt.

## Kommandon

```bash
npm run dev        # utvecklingsserver
npm run build      # produktionsbygge
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Arkitektur i korthet

| Område | Var |
|---|---|
| Publika sidor (hemsida, demo, juridik) | `app/page.tsx`, `app/book-demo/`, `app/integritetspolicy/` m.fl. |
| Inloggad app | `app/*` med delat skal i `components/app/app-shell.tsx` |
| Superadmin | `app/admin/*` (leads, bolag, branscher, support, go-live) |
| Auth-guards | `lib/auth/guards.ts` (`requireCompanyContext`, `requirePlatformAdmin` …) |
| Branschmotor | `lib/industry/registry.ts` + `supabase/migrations/…industry_registry.sql` — se `docs/industry-engine.md` |
| Planeringsmotor | `lib/planning/*` |
| Server actions | `lib/platform/actions.ts`, `lib/sales/demo-actions.ts`, `lib/support/actions.ts` |
| Vänliga fel | `lib/errors/friendly-error.ts` |
| Migreringar | `supabase/migrations/*.sql` (alltid additiva och idempotenta) |

## Dokumentation

- `docs/go-live-checklist.md` — checklista före produktionssättning
- `docs/production-env.md` — alla miljövariabler med klassificering
- `docs/customer-onboarding-runbook.md` — från lead till betalande kund
- `docs/security-review-checklist.md` — säkerhetsgranskning
- `docs/industry-engine.md` — så fungerar branschmotorn
- `docs/sales-demo-script.md` — säljdemo-manus
- `docs/manual-smoke-tests.md` — manuella röktester

## Viktiga principer

1. **Kundspråk:** kundvända ytor är på svenska och visar aldrig interna/systemtermer.
2. **Additiva migreringar:** ingen migrering får förstöra data; allt är idempotent.
3. **Företagsseparation:** all företagsdata skyddas med RLS och `company_id`-filtrering.
4. **Säkra reservlägen:** externa tjänster (e-post, rutt, AI, SMS) är valfria — saknas de
   degraderar funktionen vänligt i stället för att krascha.
