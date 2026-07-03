import { LegalPage } from '@/components/site/legal-page'
import { getLegalEmail } from '@/lib/config/emails'

export const metadata = { title: 'Integritetspolicy – Coordiqo' }

export default function IntegrityPolicyPage() {
  const legalEmail = getLegalEmail()

  return (
    <LegalPage title="Integritetspolicy" updated="juli 2026">
      <section>
        <h2>Vilka uppgifter vi samlar in</h2>
        <p>Coordiqo behandlar personuppgifter i tre huvudsakliga sammanhang:</p>
        <ul>
          <li>
            <strong>Demoansökningar.</strong> När du skickar en demoansökan sparar vi företagsnamn, organisationsnummer,
            kontaktperson, e-post, telefonnummer, bransch och det meddelande du själv skriver. Uppgifterna används för att
            kontakta dig om demo och pilot.
          </li>
          <li>
            <strong>Kundkonton.</strong> När ditt företag använder Coordiqo behandlar vi namn, e-post och roll för de
            användare företaget lägger in, samt inloggnings- och sessionsuppgifter.
          </li>
          <li>
            <strong>Verksamhetsdata.</strong> Uppgifter som ert företag själv registrerar i tjänsten — personal, kunder eller
            objekt, uppdrag, resurser och planering. För dessa uppgifter är ert företag personuppgiftsansvarigt och Coordiqo
            personuppgiftsbiträde.
          </li>
        </ul>
      </section>
      <section>
        <h2>Loggar och spårbarhet</h2>
        <p>
          Viktiga händelser i tjänsten loggas (till exempel inloggningar, ändringar och administrativa åtgärder) för att
          kunna ge support, utreda fel och upprätthålla säkerheten. Loggarna innehåller användar-referenser men inte lösenord.
        </p>
      </section>
      <section>
        <h2>Varför vi behandlar uppgifterna</h2>
        <ul>
          <li>För att leverera och förbättra tjänsten enligt avtalet med ert företag.</li>
          <li>För att kontakta dig när du själv bett om det (demo, pilot, support).</li>
          <li>För att uppfylla rättsliga skyldigheter.</li>
        </ul>
      </section>
      <section>
        <h2>Lagringstid</h2>
        <p>
          Demoansökningar sparas så länge dialogen pågår och rensas på begäran. Kunddata sparas så länge kundavtalet gäller
          och raderas eller återlämnas när avtalet upphör, enligt personuppgiftsbiträdesavtalet.
        </p>
      </section>
      <section>
        <h2>Dina rättigheter</h2>
        <p>
          Du har rätt att begära tillgång till, rättelse av eller radering av dina personuppgifter, samt att invända mot
          eller begränsa behandlingen. För uppgifter som ert företag registrerat i tjänsten kontaktar du i första hand ditt
          företag, som är personuppgiftsansvarigt.
        </p>
      </section>
      <section>
        <h2>Kundens ansvar för produktionsdata</h2>
        <p>
          Företag som använder Coordiqo ansvarar för att de personuppgifter de registrerar i tjänsten behandlas lagligt,
          att berörda personer informerats och att känsliga uppgifter endast registreras när det är nödvändigt och tillåtet.
        </p>
      </section>
      <section>
        <h2>Kontakt</h2>
        <p>Frågor om personuppgifter: <a href={`mailto:${legalEmail}`} className="font-semibold underline underline-offset-2">{legalEmail}</a></p>
      </section>
    </LegalPage>
  )
}
