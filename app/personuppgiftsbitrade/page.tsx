import { LegalPage } from '@/components/site/legal-page'
import { getLegalEmail } from '@/lib/config/emails'

export const metadata = { title: 'Personuppgiftsbiträde – Coordiqo' }

export default function DpaPage() {
  const legalEmail = getLegalEmail()

  return (
    <LegalPage title="Personuppgiftsbiträde" updated="juli 2026">
      <section>
        <h2>Coordiqo som personuppgiftsbiträde</h2>
        <p>
          När ert företag använder Coordiqo för verksamhetsdata — till exempel personal, kunder, vårdtagare, objekt och
          uppdrag — är ert företag personuppgiftsansvarigt och Coordiqo personuppgiftsbiträde. Coordiqo behandlar då
          uppgifterna endast enligt era instruktioner och för att leverera tjänsten.
        </p>
      </section>
      <section>
        <h2>Personuppgiftsbiträdesavtal (PUB-avtal)</h2>
        <p>
          För produktionskunder tecknas ett personuppgiftsbiträdesavtal som reglerar behandlingens omfattning, säkerhet,
          underbiträden, radering och rätt till granskning. PUB-avtalet är en förutsättning för att behandla skarpa
          personuppgifter i tjänsten.
        </p>
      </section>
      <section>
        <h2>Så tecknar ni avtal</h2>
        <p>
          Kontakta <a href={`mailto:${legalEmail}`} className="font-semibold underline underline-offset-2">{legalEmail}</a> så
          skickar vi ett personuppgiftsbiträdesavtal för signering. Ange företagsnamn och organisationsnummer.
        </p>
      </section>
      <section>
        <h2>Avgränsning</h2>
        <p>
          Coordiqo lämnar inga garantier om medicinsk, vård- eller annan branschspecifik regelefterlevnad utöver vad som
          uttryckligen avtalats. Kunder inom reglerade branscher ansvarar själva för att deras användning av tjänsten
          uppfyller branschens krav, och kan kontakta oss för en gemensam genomgång.
        </p>
      </section>
    </LegalPage>
  )
}
