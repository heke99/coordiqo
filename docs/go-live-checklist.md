# Go-live-checklista

Kör igenom hela listan innan produktionssättning. Använd även **/admin/go-live** i appen,
som kontrollerar flera av punkterna automatiskt.

1. **Supabase-produktionsprojekt klart** — eget projekt för produktion, separat från test/pilot.
2. **Migreringar körda** — alla filer i `supabase/migrations/` applicerade i ordning utan fel.
3. **RLS aktiverat** — `/admin/go-live` visar inga tabeller utan radskydd.
4. **Service role endast server-side** — `SUPABASE_SERVICE_ROLE_KEY` finns bara som server-variabel,
   aldrig med `NEXT_PUBLIC_`-prefix.
5. **Vercel-miljövariabler konfigurerade** — se `docs/production-env.md` för komplett lista.
6. **Domän konfigurerad** — produktionsdomän pekar på appen, `NEXT_PUBLIC_SITE_URL` uppdaterad.
7. **E-postdomän konfigurerad** — Resend-domän verifierad, `COORDIQO_FROM_EMAIL` satt till adress på egen domän.
8. **Inbjudningsmejl testat** — skapa testinbjudan, kontrollera att mejlet kommer fram och länken fungerar.
9. **Demoformulär testat** — skicka demoansökan från publika webben, kontrollera att den syns i admin.
10. **Lead-adminflöde testat** — ändra status, sätt ansvarig, lägg notering på en testlead.
11. **Bolagsskapande från demo testat** — skapa bolag från testlead, kontrollera standardinnehållet.
12. **Första-admin-invite testat** — skapa admin med tillfälligt lösenord, logga in, byt lösenord.
13. **Onboarding testad** — gå igenom onboarding-stegen för minst en bransch.
14. **Branschstandarder testade** — kontrollera uppdragstyper/resurstyper/objekttyper för lanseringsbranscherna.
15. **Planerings-röktest klart** — skapa uppdrag, kör planering, publicera, se resultatet i mobilvyn.
16. **Supportmejl testat** — skapa supportärende, kontrollera att mejl når `COORDIQO_SUPPORT_EMAIL`.
17. **Juridiska sidor granskade** — integritetspolicy, villkor, PUB, cookies och säkerhet granskade av juridiskt ombud.
18. **Backup/restore-plan dokumenterad** — Supabase-backuper verifierade; testa en restore till separat projekt.
19. **Rollback-plan dokumenterad** — hur ni återställer förra appversionen (Vercel) och vad ni gör vid migreringsproblem.
20. **Plattformsadminkonto säkrat** — starkt lösenord, gärna separat e-post; inga delade admin-konton.
