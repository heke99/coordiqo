# Runbook: från lead till betalande kund

Praktisk arbetsgång för Coordiqo-teamet. Alla steg görs i admin (`/admin`).

## 1. Hantera ny lead

- Nya demoansökningar landar i **Admin → Demoansökningar** med status **Ny**.
- Notifiering skickas till `COORDIQO_SALES_EMAIL` (eller köas om e-post inte är konfigurerad).
- Sätt **ansvarig** och **nästa kontakt** direkt så inget faller mellan stolarna.
- Kontakta leaden inom 1–2 arbetsdagar. Uppdatera status till **Kontaktad**.

## 2. Kvalificera bolaget

Frågor att besvara innan demo:

- Vilken bransch och hur planerar de idag?
- Hur många i personal ute på fältet? Hur många uppdrag per vecka?
- Vilka är de 2–3 viktigaste problemen (personalplanering, resurser, avvikelser...)?
- Vem beslutar och vem blir administratör?

Sätt status **Kvalificerad**, lägg interna noteringar på leaden.

## 3. Demo

- Skapa ett demobolag i kundens bransch: **Admin → Bolag → Skapa demobolag**.
- Följ `docs/sales-demo-script.md`.
- Sätt status **Demo bokad** före mötet.

## 4. Skapa pilot

- Sätt status **Pilot erbjuden** när förslaget skickats.
- När kunden tackar ja: öppna leaden → **Skapa bolag från ansökan**.
  - Branschen valideras mot registret, standardinnehåll och onboarding skapas automatiskt.
  - Om något går snett: öppna bolaget och kör **Reparera standarder**.
- Sätt paket **Pilot**, pilotens start-/slutdatum och avtalsstatus **Pilot** på bolagssidan.

## 5. Välj bransch och arbetssätt

- Kontrollera på bolagssidan att bransch och arbetssätt stämmer.
- Byt vid behov med **Byt bransch säkert** — standardinnehåll fylls på utan att data tas bort.

## 6. Skapa första administratör

- På leadsidan: **Skapa första administratör** med kundens e-post och ett starkt tillfälligt lösenord
  (minst 12 tecken, stor+liten bokstav, siffra).
- Ett välkomstmejl skickas automatiskt om e-post är konfigurerad — annars: skicka inloggningsuppgifterna
  via säker kanal och använd **Skicka igen** för inbjudningar vid behov.
- Administratören tvingas byta lösenord vid första inloggning.

## 7. Guida onboarding

- Administratören möts av onboarding-stegen (anpassade efter bransch).
- Boka ett 45-minuters uppstartsmöte: gå igenom team, personal, kunder/objekt och uppdragstyper tillsammans.
- Följ förloppet under **Admin → Plattformshälsa** (onboardingstatus per bolag).

## 8. Verifiera första planeringen

- Be kunden skapa 5–10 riktiga uppdrag.
- Kör en planering tillsammans, justera och publicera.
- Verifiera att personalen ser sitt arbete i mobilvyn (**Min dag**).
- Detta är pilotens "aha-ögonblick" — hoppa inte över det.

## 9. Från pilot till betalande kund

- Boka uppföljning halvvägs och i slutet av piloten (mall: pilotuppföljningsmejl).
- Vid avslut: uppdatera bolagets paket (Standard/Pro/Enterprise), avtalsstatus **Aktivt avtal**,
  faktureringsuppgifter och förnyelsedatum på bolagssidan.
- Sätt leadens status till **Vunnen**. Vid nej: **Förlorad** med orsak (krävs).
- Teckna personuppgiftsbiträdesavtal innan skarpa personuppgifter behandlas i produktion.
