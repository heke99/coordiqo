import { LegalPage } from '@/components/site/legal-page'
import { getLegalEmail } from '@/lib/config/emails'

export const metadata = { title: 'Villkor – Coordiqo' }

export default function TermsPage() {
  const legalEmail = getLegalEmail()

  return (
    <LegalPage title="Användarvillkor" updated="juli 2026">
      <section>
        <h2>Tjänsten</h2>
        <p>
          Coordiqo är en molntjänst (SaaS) för planering av personal, uppdrag, rutter och resurser. Tjänsten
          tillhandahålls enligt avtal mellan Coordiqo och kundföretaget. Dessa villkor gäller för användning av tjänsten
          och kompletteras av det avtal och eventuellt personuppgiftsbiträdesavtal som tecknas med respektive kund.
        </p>
      </section>
      <section>
        <h2>Kundens ansvar</h2>
        <ul>
          <li>Att uppgifterna som registreras i tjänsten är korrekta och får behandlas.</li>
          <li>Att användarkonton hanteras ansvarsfullt och att lösenord inte delas.</li>
          <li>Att tjänsten inte används för olagligt innehåll eller verksamhet.</li>
          <li>Att utse ansvariga administratörer och hålla kontaktuppgifter uppdaterade.</li>
        </ul>
      </section>
      <section>
        <h2>Acceptabel användning</h2>
        <p>
          Det är inte tillåtet att försöka kringgå säkerhetsfunktioner, få åtkomst till andra kunders data, belasta
          tjänsten på ett onormalt sätt eller använda tjänsten för att skada tredje part.
        </p>
      </section>
      <section>
        <h2>Tillgänglighet</h2>
        <p>
          Vi strävar efter hög tillgänglighet men garanterar den inte utan särskilt avtal (SLA). Planerat underhåll
          meddelas i förväg när det är möjligt. Tjänsten kan tillfälligt begränsas vid drift- eller säkerhetsproblem.
        </p>
      </section>
      <section>
        <h2>Pilot och testperioder</h2>
        <p>
          Under pilot- eller testperioder tillhandahålls tjänsten i befintligt skick. Funktioner kan ändras och
          begränsningar kan förekomma. Piloter är inte avsedda för kritisk produktionsdrift utan särskild överenskommelse.
        </p>
      </section>
      <section>
        <h2>Support</h2>
        <p>
          Support ingår enligt vald paketnivå. Supportärenden skapas i tjänsten eller via e-post. Svarstider regleras i
          kundavtalet.
        </p>
      </section>
      <section>
        <h2>Uppsägning samt export och radering av data</h2>
        <p>
          Vid avtalets upphörande kan kunden begära export av sin data i maskinläsbart format. Därefter raderas kundens
          data enligt personuppgiftsbiträdesavtalet, med undantag för det som måste sparas enligt lag.
        </p>
      </section>
      <section>
        <h2>Kontakt</h2>
        <p>Frågor om villkoren: <a href={`mailto:${legalEmail}`} className="font-semibold underline underline-offset-2">{legalEmail}</a></p>
      </section>
    </LegalPage>
  )
}
