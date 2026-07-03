import { LegalPage } from '@/components/site/legal-page'
import { getSupportEmail } from '@/lib/config/emails'

export const metadata = { title: 'Säkerhet – Coordiqo' }

export default function SecurityPage() {
  const supportEmail = getSupportEmail()

  return (
    <LegalPage title="Säkerhet" updated="juli 2026">
      <section>
        <h2>Åtkomstkontroll och roller</h2>
        <p>
          Alla användare loggar in med personliga konton. Behörigheter styrs av roller — från företagsadministratör till
          fältpersonal — och varje användare ser bara det rollen tillåter. Principen om lägsta möjliga behörighet gäller
          både för kunder och för Coordiqos egen personal.
        </p>
      </section>
      <section>
        <h2>Företagsseparation</h2>
        <p>
          Varje kunds data är strikt separerad. Separationen upprätthålls på radnivå direkt i databasen, vilket innebär
          att ett företags användare aldrig kan läsa ett annat företags uppgifter — även om ett fel skulle inträffa i
          applikationslagret.
        </p>
      </section>
      <section>
        <h2>Spårbarhet</h2>
        <p>
          Viktiga händelser loggas: administrativa åtgärder, ändringar av planering, behörighetsändringar och
          supportåtkomst. Supportpersonalens åtkomst till kundmiljöer sker genom särskilda supportsessioner som loggas
          och tidsbegränsas.
        </p>
      </section>
      <section>
        <h2>Kryptering</h2>
        <p>All trafik mellan din webbläsare och tjänsten krypteras (TLS). Data lagras hos etablerade europeiska molnleverantörer.</p>
      </section>
      <section>
        <h2>Säkerhetskopiering</h2>
        <p>
          Databasen säkerhetskopieras löpande av vår driftleverantör. Kunder ansvarar för att exportera egna kopior av
          data de vill arkivera utanför tjänsten, om inte annat avtalats.
        </p>
      </section>
      <section>
        <h2>Ingen publik kunddata</h2>
        <p>
          Ingen kunddata exponeras publikt. De enda publika ytorna är marknadswebben och demoformuläret, som endast tar
          emot uppgifter — aldrig visar dem.
        </p>
      </section>
      <section>
        <h2>Rapportera en sårbarhet</h2>
        <p>
          Har du upptäckt en säkerhetsbrist? Kontakta oss direkt på{' '}
          <a href={`mailto:${supportEmail}`} className="font-semibold underline underline-offset-2">{supportEmail}</a> så
          återkommer vi skyndsamt.
        </p>
      </section>
    </LegalPage>
  )
}
