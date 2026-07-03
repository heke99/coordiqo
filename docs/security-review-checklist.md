# Säkerhetsgranskning — checklista

Gå igenom före go-live och därefter vid varje större release.

## Radnivåskydd (RLS)

- [ ] `/admin/go-live` visar inga tabeller utan RLS.
- [ ] Nya tabeller i migreringar har `enable row level security` + policyer i samma migrering.
- [ ] Company-ägda tabeller kräver `is_company_member(company_id)` för läsning.
- [ ] Skrivpolicyer kräver rimlig roll (`has_company_role(...)`), inte bara medlemskap, för känsliga tabeller.
- [ ] Publika tabeller (demo_requests) tillåter endast INSERT — aldrig läsning av befintliga rader.

## Service role

- [ ] `SUPABASE_SERVICE_ROLE_KEY` finns endast som server-variabel.
- [ ] Ingen `NEXT_PUBLIC_`-variabel innehåller service-nyckeln (kontrolleras på /admin/go-live).
- [ ] Alla `supabaseAdmin`-frågor mot företagsdata filtrerar på `company_id` från serverns sessionskontext
      (aldrig från klient-input).

## Miljövariabler

- [ ] Produktionshemligheter finns bara i Vercel/hostingmiljön, inte i repo eller loggar.
- [ ] `.env.example` innehåller inga riktiga värden.

## Publika formulär

- [ ] Demoformuläret validerar server-side (e-post, samtycke, längder, whitelistade värden).
- [ ] Honeypot-fältet finns kvar i formuläret.
- [ ] Inga råa fel visas för besökare.

## Känsliga fält

- [ ] Dynamiska fält markerade `is_sensitive` döljs för roller under Planerare.
- [ ] Känsliga värden loggas inte i audit-metadata.
- [ ] Känsliga värden skickas inte till AI-tjänster eller webhooks.

## Audit

- [ ] Administrativa åtgärder (bolagsstyrning, leads, support, behörigheter) loggas.
- [ ] Undantag/overrides i planeringen loggas med orsak.
- [ ] Supportsessioner loggas med start, slut och orsak.

## Supportåtkomst

- [ ] Supportsessioner är tidsbegränsade och kräver orsak.
- [ ] Plattformsadmin-roller är begränsade till nödvändig personal.

## Företagsseparation

- [ ] Manuellt test: användare i bolag A kan inte se bolag B:s data (uppdrag, personal, objekt, dokument).
- [ ] Företagsbyte kan inte manipuleras från klienten (verifieras mot medlemskap server-side).
- [ ] Pausade/inaktiva bolag blockeras vid inloggning.

## Roller

- [ ] Fältpersonal (`staff`) kan inte öppna admin eller inställningar.
- [ ] Endast företagsadmin kan ändra bransch, behörigheter och support.
- [ ] UI döljer åtgärder rollen saknar — men servern är alltid den som avgör.

## Dataexport och radering

- [ ] Rutin finns för att exportera ett bolags data på begäran.
- [ ] Rutin finns för att radera ett bolags data vid avtalsslut (PUB-avtal).
- [ ] Demobolag kan raderas separat utan att röra kunddata (endast `is_demo = true`).
