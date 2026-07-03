# Manuella röktester

Kör hela listan i en produktionslik miljö före go-live. Markera varje punkt.

## Huvudflöde (30 steg)

1. [ ] Besökare öppnar startsidan (`/`).
2. [ ] Besökaren ser svensk säljtext (hero, problem, branscher, funktioner).
3. [ ] Besökaren öppnar demosidan (`/book-demo`).
4. [ ] Demosidan listar aktiva branscher från registret.
5. [ ] Besökaren skickar en demoansökan (alla obligatoriska fält).
6. [ ] Bekräftelsen "Tack — vi har tagit emot din förfrågan…" visas.
7. [ ] Internt säljmejl skickas till `COORDIQO_SALES_EMAIL` eller syns som köat i `outbound_emails`.
8. [ ] Plattformsadmin ser leaden under **Admin → Demoansökningar**.
9. [ ] Plattformsadmin ändrar status (t.ex. Kontaktad → Kvalificerad).
10. [ ] Plattformsadmin skapar bolag från leaden.
11. [ ] Plattformsadmin skapar första administratör med tillfälligt lösenord.
12. [ ] Administratören får välkomstmejl, eller admin ser "Skicka igen" för inbjudan.
13. [ ] Administratören loggar in med tillfälligt lösenord.
14. [ ] Administratören tvingas byta lösenord och skickas till onboarding.
15. [ ] Onboarding visar branschanpassade steg (jämför två olika branscher).
16. [ ] Standardinnehåll finns: objekttyper, uppdragstyper, resurstyper.
17. [ ] Översikten laddar utan fel och visar onboarding-bannern.
18. [ ] Första personalprofilen kan skapas.
19. [ ] Första kunden/objektet/platsen kan skapas.
20. [ ] Första uppdraget kan skapas (branschanpassade ordval i formuläret).
21. [ ] Planeringssidan öppnas och en planeringskörning kan skapas.
22. [ ] What-if-sidan öppnas och visar resurser (ingen krasch, rätt tabell).
23. [ ] Mobilvyn (**Min dag** och **Mina resurser**) fungerar för en personal-användare.
24. [ ] Supportärende kan skapas under **Inställningar → Support**.
25. [ ] Juridiska sidor öppnas: /integritetspolicy, /villkor, /personuppgiftsbitrade, /cookies, /sakerhet.
26. [ ] **Admin → Go-live** visar beredskapsstatus utan kritiska fel.
27. [ ] Företag A kan inte se företag B:s data (testa med två konton i olika bolag).
28. [ ] En användare med rollen Personal kan inte öppna /admin (skickas till "saknar behörighet").
29. [ ] Inloggad användare utan bolag skickas till /setup.
30. [ ] Inga råa databas-/systemfel visas någonstans i UI (endast vänliga svenska meddelanden).

## Branschregression

Testa minst dessa branscher: `home_care`, `cleaning`, `property`, `construction`,
`courier`, `municipality`, `staffing`, `security`, `other`.

Snabbaste sättet: skapa ett demobolag per bransch (**Admin → Bolag → Skapa demobolag**).

För varje bransch, verifiera:

| Kontroll | OK |
|---|---|
| Onboarding visar branschens steg (t.ex. Nycklar/passerkort för hemtjänst, Kalkyl för bygg) | [ ] |
| Ordvalen ändras (uppdrag/insats/ärende/leverans, objekt/vårdtagare/fastighet/mottagare) | [ ] |
| Standardobjekttyper finns | [ ] |
| Standarduppdragstyper finns | [ ] |
| Standardresurstyper finns | [ ] |
| Översikten kraschar inte | [ ] |
| Planeringssidan öppnas | [ ] |
| Mobilvyn fungerar | [ ] |
| Inga interna/system-ord syns (tenant, runtime, RLS, UUID, Supabase …) | [ ] |
