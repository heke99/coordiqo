# Branschmotorn (industry engine)

Coordiqo stödjer många branscher med **en** flexibel motor. Ingen bransch är hårdkodad i
produkt, onboarding, databas eller UI — allt styrs av branschregistret i databasen.

## Arkitektur

```
public.industry_types (branschregistret — en rad per bransch)
  ├── name_sv / name_en / beskrivningar
  ├── default_operational_model + allowed_operational_models
  ├── terminology (jsonb)         → ordval i UI (uppdrag/insats/leverans …)
  ├── task_types (jsonb)          → standarduppdragstyper
  ├── resource_types (jsonb)      → standardresurstyper
  ├── statuses / planning_rules / mobile_actions (jsonb)
  ├── onboarding_template (jsonb) → branschanpassade onboarding-steg
  └── feature_defaults (jsonb)

public.industry_entity_presets   → objekttyper per bransch (vårdtagare, fastighet …)
public.industry_runtime_configs  → per-bolag: vald bransch, arbetssätt, terminologi-overrides
public.ensure_company_industry_defaults(uuid)
                                 → idempotent funktion som skapar/reparerar ett bolags
                                   standardinnehåll utifrån registret
```

TypeScript-lagret:

- `lib/industry/registry.ts` — laddar registret från databasen med cache och **statiskt
  reservläge** (`lib/industry/config.ts`) om databasen inte kan nås.
  - `getActiveIndustryProfiles()` — aktiva branscher för väljare och publika sidor.
  - `getIndustryProfile(code)` — okända koder faller alltid tillbaka till `other` (kraschar aldrig).
  - `resolveIndustryTerminology(companyId)` — bolagets ordval: runtime-config → branschprofil → neutral standard.
- `lib/onboarding/progress.ts` — bygger onboarding-stegen från `onboarding_template`.

## Lägga till en ny bransch (utan kodändring)

1. Öppna **Admin → Branscher**.
2. Fyll i kod (t.ex. `lantbruk`), svenskt namn och primärt arbetssätt → **Skapa bransch**.
3. Branschen får neutralt standardinnehåll och en komplett onboarding-mall direkt.
4. Justera terminologi, uppdragstyper m.m. direkt i databasen (kolumnerna på `industry_types`)
   eller via kommande admin-formulär.
5. Branschen blir omedelbart valbar i setup, demoformulär, onboarding och bolagsadministration.

## Byta bransch på ett bolag

**Admin → Bolag → [bolaget] → Byt bransch säkert.** Detta:

- uppdaterar bolagets bransch och arbetssätt,
- kör `ensure_company_industry_defaults` som **lägger till** saknat standardinnehåll,
- tar **aldrig** bort befintliga typer, uppdrag eller data.

## Terminologi

Kundens UI använder alltid ordvalen från `resolveIndustryTerminology`:

| Nyckel | Exempel (hemtjänst) | Exempel (bud/kurir) | Neutral standard |
|---|---|---|---|
| `task` / `tasks` | Insats / Insatser | Leverans / Leveranser | Uppdrag |
| `entity` / `entities` | Vårdtagare | Mottagare och kunder | Objekt |
| `staff` | Personal | Bud | Personal |
| `route` | Rutt | Leveransrutt | Rutt |
| `resources` | Resurser | Fordon/utrustning | Resurser |
| `schedule` | Schema | Schema | Schema |

Ett bolag kan skriva över enskilda ord via `industry_runtime_configs.terminology`.

## Säkerhetsregler

- `industry_runtime_configs.industry_code` har främmande nyckel till registret —
  ogiltiga koder kan inte sparas.
- Om ett bolag har en kod som saknas i registret faller `ensure_company_industry_defaults`
  tillbaka till `other` i stället för att misslyckas.
- Branschen `other` kan aldrig arkiveras (den är det säkra standardvalet).
- Registret är publikt läsbart (för marknadswebben) men bara plattformsadmin kan skriva.
